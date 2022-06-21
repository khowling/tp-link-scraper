
const fetch = require('./server_fetch')

async function get_allinfo(url, method = 'GET', headers = {}, body) {

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

    const page_data = await auth_fetch(url, method, headers, body)
    const all_info = page_data.match(/all_info = ([\s\S]*?);/)

    const bcInfo = page_data.match(/bcInfo = new Array\(([\s\S]*?)\)/)

    if (all_info && all_info.length > 0) {
        return JSON.parse(all_info[1].replace(/(['"])?([a-z0-9A-Z_]+)(['"])?:/g, '"$2": '))
    } else if (bcInfo && bcInfo.length > 0) {
        return bcInfo[1].replace('\n','').split(',').filter((a,i) => i%3 === 1).map(i => Math.floor(parseInt(i.replace('\n',''))/1000))
    } else {
        throw new Error(`page doesnt contain all_info`)
    }

}

const PORT_MAPPING = ["hub", "mum_office", "master_bdrm", "dad_office", "living_room", "kitchen", "girl_bdrm", "boy_bdrm"]
const SPEED = ["Link Down", "Auto", "10MH", "10MF", "100MH", "100MF", "1000MF"]

const http = require('http')

let app = http.createServer(async (req, res) => {
    if (req.url === '/metrics') {
        try {

            const json_res = await get_allinfo(`${process.env.SWITCH_MANAGEMENT_URL}/${process.env.SWITCH_MANAGEMENT_STATS}`)

            let out = ""
            for (let port in PORT_MAPPING) {
                const pkts_idx = port * 4
                out += `managed_switch_TxPkt{room="${PORT_MAPPING[port]}"} ${json_res.pkts[pkts_idx]}` + '\n'
                out += `managed_switch_RxPkt{room="${PORT_MAPPING[port]}"} ${json_res.pkts[pkts_idx + 2]}` + '\n'
            }
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end(out)

        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(e.message)
        }
    } else if (req.url === '/grafana') {
        res.writeHead(302, { 'Location': `http://${req.headers.host.split(":")[0]}:3000/d/T3OrKihMk/our-house?orgId=1` })
        res.end()

    } else if (req.url.startsWith('/setport?')) {

        try {
            const param = req.url.match('[?&]param=([^&]+)'),
                  paramval = param ? decodeURIComponent(param[1]) : null
                  returl = req.url.match('[?&]returl=([^&]+)'),
                  returlval = returl ? decodeURIComponent( returl[1]) : null

            console.log(`Updating port : ${paramval}`)
            // portid=${port}&state=${state}&speed=${speed}&flowcontrol=${flowcontrol}&apply=Apply
            const json_res = await get_allinfo(`${process.env.SWITCH_MANAGEMENT_URL}/port_setting.cgi?${paramval}`, 'GET', { "referer": `${process.env.SWITCH_MANAGEMENT_URL}/PortSettingRpm.htm` })
            res.writeHead(302, { 'Location': returlval || '/' })
            res.end()
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(e)
        }

    } else if (req.url.startsWith('/setSpeed?')) {

        try {
            const form = req.url.match('[?&]form=([^&]+)'),
                  formval = form ? decodeURIComponent(form[1]) : null
                  returl = req.url.match('[?&]returl=([^&]+)'),
                  returlval = returl ? decodeURIComponent( returl[1]) : null

            console.log(`Updating port : ${formval}`)
            // portid=${port}&state=${state}&speed=${speed}&flowcontrol=${flowcontrol}&apply=Apply
            const json_res = await get_allinfo(`${process.env.SWITCH_MANAGEMENT_URL}/qos_bandwidth_set.cgi`, 'POST', { 
                "content-type": "application/x-www-form-urlencoded",
                "referer": `${process.env.SWITCH_MANAGEMENT_URL}/QosBandWidthControlRpm.htm` }, formval)
            res.writeHead(302, { 'Location': returlval || '/' })
            res.end()
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(e)
        }

    } else if (req.url === '/') {

        try {

            const json_res = await get_allinfo(`${process.env.SWITCH_MANAGEMENT_URL}/PortSettingRpm.htm`)
            const port_res = await get_allinfo(`${process.env.SWITCH_MANAGEMENT_URL}/QosBandWidthControlRpm.htm`)

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
                            <th>QoS</th>
                        </tr>`


            for (let port in PORT_MAPPING) {
                out += `
                <tr>
                    <td>${PORT_MAPPING[port]}</td>
                    <td>
                        <a href="javascript:window.location.href=\'setport?param=\' + encodeURIComponent(\'portid=${parseInt(port) + 1}&state=${json_res.state[port] ? "0" : "1"}&speed=${json_res.spd_cfg[port]}&flowcontrol=${json_res.fc_cfg[port]}\') + \'&returl=\' + encodeURIComponent(window.location.href)">${["Disabled", "Enabled"][json_res.state[port]]}<a/>
                    </td>
                    <td>${SPEED[json_res.spd_cfg[port]]} (${SPEED[json_res.spd_act[port]]})</td>
                    <td>
                        <a href="javascript:window.location.href=\'setSpeed?form=\' + encodeURIComponent(\'igrRate=0&egrRate=${port_res[port] === 0 ? 20000 : port_res[port] === 20 ? 40000 : 0}&sel_${parseInt(port) + 1}=1&applay=Apply\') + \'&returl=\' + encodeURIComponent(window.location.href)">${port_res[port] ? `${port_res[port]} Mbps` : 'Unlimited'}<a/>
                    </td>
                </tr>`
            }
            out += `
                    </table>
                </body>
            </html>`
            res.end(out)

        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(e.message)
        }
    } else {
        res.end()
    }
});

// Start the server on port 3000
app.listen(3998);
console.log('Node server running on port 3998');


