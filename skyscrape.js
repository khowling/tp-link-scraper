const fetch = require('./server_fetch')

const PORT_LABELS = ["Status", "TxPkts", "RxPkts", "CollisionPkts", "Tx b/s", "Rx b/s", "Uptime"]

async function get_table_info(url, method = 'GET', headers = {}, body) {

    const page_data = await fetch(url, method, headers, body)

    const wan_stats = page_data.match(/<tr><td>WAN<\/td>(.*?)<\/tr>/)
    const lan_stats = page_data.match(/<tr><td>LAN<\/td>(.*?)<\/tr>/)

    let ret = {}
    if (wan_stats && wan_stats.length > 0) {
        ret.WAN = Object.assign({}, ...wan_stats[1].split('<td>').splice(1).map(function (a, i) { return { [PORT_LABELS[i]]: a.replace(/<\/td>\s*$/, "") } }))
    } else {
        throw new Error("No WAN data in page")
    }
    if (lan_stats && lan_stats.length > 0) {
        ret.LAN = Object.assign({}, ...lan_stats[1].split('<td>').splice(1).map(function (a, i) { return { [PORT_LABELS[i]]: a.replace(/<\/td>\s*$/, "") } }))
    } else {
        throw new Error("No WAN data in page")
    }

    return ret
}

const http = require('http')
let app = http.createServer(async (req, res) => {
    if (req.url === '/metrics') {
        // Set a response type of plain text for the response
        try {
            const json_res = await get_table_info(process.env.ROUTER_STATS_URL, "GET", { "Authorization": process.env.ROUTER_STATS_URL_AUTH, "referer": process.env.ROUTER_STATS_URL })


            let out = ""
            for (port of ["WAN", "LAN"]) {
                for (label_idx of [1, 2, 3, 4, 5]) {
                    out += `skyrouter_${PORT_LABELS[label_idx].replace(/ /g, "_")}{port="${port}"} ${json_res[port][PORT_LABELS[label_idx]]}` + '\n'
                }
            }
            res.writeHead(200, { 'Content-Type': 'text/plain' });
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
app.listen(3997);
console.log('Node server running on port 3997');


