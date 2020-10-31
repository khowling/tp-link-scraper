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

async function auth_fetch(url, method, headers, body, retry = false) {

    const response_html = await fetch(url, method, headers, body)

    if (response_html.indexOf('logonInfo') > 0) {
        if (retry) {
            throw new Error(`Failed to login`)
        } else {
            console.log(`got the login page`)
            const login_res = await fetch(`${process.env.SWITCH_MANAGEMENT_URL}/logon.cgi`, 'POST',
                { "content-type": "application/x-www-form-urlencoded", "referer": url },
                process.env.LOGIN_FORM_DATA)
            return await auth_fetch(url, method, headers, body, true)
        }
    } else {
        return response_html
    }
}

async function get_allinfo(url, method = 'GET', headers = {}, body) {
    try {
        const page_data = await auth_fetch(url, method, headers, body)
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

// state 0=disable, 1=enable
// speed 1 = Auto
// flowcontrol 0=off, 1=on
async function disable_port(port, state, speed = 1, flowcontrol = 0) {
    const disable_res = await auth_fetch(`${process.env.SWITCH_MANAGEMENT_URL}/port_setting.cgi?portid=${port}&state=${state}&speed=${speed}&flowcontrol=${flowcontrol}&apply=Apply`, 'GET', { "referer": `${process.env.SWITCH_MANAGEMENT_URL}/PortSettingRpm.htm` })
}


const PORT_MAPPING = ["hub", "mum_office", "master_bdrm", "dad_office", "living_room", "kitchen", "girl_bdrm", "boy_bdrm"]
const SPEED = ["Link Down", "Auto", "10MH", "10MF", "100MH", "100MF", "1000MF"]
const FLOW = ["Off", "On"]

let app = http.createServer(async (req, res) => {
    if (req.url === '/metrics') {
        // Set a response type of plain text for the response
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        const json_res = await get_allinfo(`${process.env.SWITCH_MANAGEMENT_URL}/${process.env.SWITCH_MANAGEMENT_STATS}`)

        if (json_res.failed) {
            res.end(json_res)
        } else {
            let out = ""
            for (let port in PORT_MAPPING) {
                const pkts_idx = port * 4
                out += `managed_switch_TxPkt{room="${PORT_MAPPING[port]}"} ${json_res.pkts[pkts_idx]}` + '\n'
                out += `managed_switch_RxPkt{room="${PORT_MAPPING[port]}"} ${json_res.pkts[pkts_idx + 2]}` + '\n'
            }
            res.end(out)
        }
    } else if (req.url === '/grafana') {
        res.writeHead(302, { 'Location': `http://${req.headers.host.split(":")[0]}:3000` })
        res.end()

    } else if (req.url.startsWith('/setport?')) {

        const port_updates = req.url.split('?')[1]
        console.log(`Updating port : ${port_updates}`)
        // portid=${port}&state=${state}&speed=${speed}&flowcontrol=${flowcontrol}&apply=Apply
        const json_res = await get_allinfo(`${process.env.SWITCH_MANAGEMENT_URL}/port_setting.cgi?${port_updates}`, 'GET', { "referer": `${process.env.SWITCH_MANAGEMENT_URL}/PortSettingRpm.htm` })
        res.writeHead(302, { 'Location': '/' })
        res.end()

    } else if (req.url === '/') {
        const json_res = await get_allinfo(`${process.env.SWITCH_MANAGEMENT_URL}/PortSettingRpm.htm`)

        if (json_res.failed) {
            res.end(json_res)
        } else {
            let out = `
            <html>
                <head>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                    body{
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                     }
                     div{
                        overflow-x: auto;
                     }
                     table {
                        border-collapse: collapse;
                        border-spacing: 0;
                        width: 100%;
                        border: 1px solid rgb(0, 0, 0);
                     }
                     th, td {
                        text-align: left;
                        padding: 8px;
                     }
                     tr:nth-child(even){background-color: #f2f2f2}
                  </style>
                </head>
                <body>
                    <table>
                        <tr>
                            <th>Room (<a href="/grafana">Metrics</a>)</th>
                            <th>Enabled (toggle)</th>
                            <th>Speed (actual) </th>
                            <th>Flow Ctrl (actual)</th>
                        </tr>`


            for (let port in PORT_MAPPING) {
                out += `
                <tr>
                    <td>${PORT_MAPPING[port]}</td>
                    <td><a href="/setport?portid=${parseInt(port) + 1}&state=${json_res.state[port] ? "0" : "1"}&speed=${json_res.spd_cfg[port]}&flowcontrol=${json_res.fc_cfg[port]}">${["Disabled", "Enabled"][json_res.state[port]]}<a/></td>
                    <td>${SPEED[json_res.spd_cfg[port]]} (${SPEED[json_res.spd_act[port]]})</td>
                    <td>${FLOW[json_res.fc_cfg[port]]} (${FLOW[json_res.fc_act[port]]})</td>
                </tr>`
            }
            out += `
                    </table>
                </body>
            </html>`
            res.end(out)
        }
    } else {
        res.end()
    }
});

// Start the server on port 3000
app.listen(3998, '127.0.0.1');
console.log('Node server running on port 3998');


