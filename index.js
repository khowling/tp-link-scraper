const http = require('http')

function fetch(url, method = 'GET', headers = {}, body) {
    const opts = { method, headers }

    if (body) {
        opts.headers['content-length'] = Buffer.byteLength(body)
    }

    return new Promise(function (resolve, reject) {
        const req = http.request(url, opts, (res) => {

            if (res.statusCode !== 200 && res.statusCode !== 201) {
                let error = new Error(`Request Failed: Status Code: ${res.statusCode}`)
                //console.error(error.message)
                // Consume response data to free up memory
                res.resume();
                //throw new Error(error)
                reject(error.message)
            } else {

                // required to process binary image data into base64
                const contentType = res.headers['content-type']

                // collect the data chunks
                var strings = []
                res.on('data', function (chunk) {
                    strings.push(chunk)
                })
                res.on('end', () => {

                    if (strings.length === 0) {
                        resolve()
                    } else {

                        let body = strings.join('')
                        if (/^application\/json/.test(contentType)) {

                            try {
                                const parsedData = JSON.parse(body)
                                resolve(parsedData)
                            } catch (e) {
                                console.error(`server_fetch: ${e}`)
                                reject(e)
                            }
                        } else if (/^text\/html/.test(contentType)) {
                            return resolve(body)
                        } else if (/^image/.test(contentType)) {
                            resolve(Buffer.from(body, 'binary').toString('base64'))
                        } else {
                            reject(`Unknown content-type : ${contentType}`)
                        }
                    }
                })
            }
        }).on('error', (e) => {
            console.error(`server_fetch: ${e.message}`)
            reject(e.message)
        })

        if (opts.method === 'POST' || opts.method === 'PUT') {
            // Write data to request body
            req.end(body)
        } else {
            req.end()
        }

    })
}

async function scrape() {

    async function portstats(retry) {

        const metrics_page = await fetch(`${process.env.SWITCH_MANAGEMENT_URL}/${process.env.SWITCH_MANAGEMENT_STATS}`)

        if (metrics_page.indexOf('logonInfo') > 0) {
            if (retry === true) {
                throw new Error(`Failed to login`)
            } else {
                console.log(`got the login page`)
                const login_res = await fetch(`${process.env.SWITCH_MANAGEMENT_URL}/logon.cgi`, 'POST',
                    { "content-type": "application/x-www-form-urlencoded", "referer": `${process.env.SWITCH_MANAGEMENT_URL}/${process.env.SWITCH_MANAGEMENT_STATS}` },
                    process.env.LOGIN_FORM_DATA)
                return await portstats(true)
            }
        } else {
            return metrics_page
        }
    }


    try {

        const page_data = await portstats(false)
        const page_data_match = page_data.match(/all_info = ([\s\S]*?);/)

        if (page_data_match && page_data_match.length > 0) {
            return JSON.parse(page_data_match[1].replace(/(['"])?([a-z0-9A-Z_]+)(['"])?:/g, '"$2": '))
        } else {
            console.error(`page doesnt contain all_info`)
            return { "failed": "true" }
        }
    } catch (e) {
        console.error(e)
        return { "failed": "true" }
    }
}


let app = http.createServer(async (req, res) => {
    // Set a response type of plain text for the response
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    const json_res = await scrape()

    if (json_res.failed) {
        res.end(json_res)
    } else {
        let out = "", idx = 0
        for (let port of ["router", "mum_office", "master_bdrm", "dad_office", "living_room", "kitchen", "girl_bdrm", "boy_bdrm"]) {
            out += `managed_switch_TxPkt{room="${port}"} ${json_res.pkts[idx]}` + '\n'
            out += `managed_switch_RxPkt{room="${port}"} ${json_res.pkts[idx + 2]}` + '\n'
            idx += 4
        }
        res.end(out)
    }
});

// Start the server on port 3000
app.listen(3998, '127.0.0.1');
console.log('Node server running on port 3998');


