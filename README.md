
# Prometheus scraper for TP-LINK Managed Switch 

Scrape the metrics from a TP-LINK managed switch & a Sky Router, and expose as a target for Prometheus.

![Grahana](/assets/network.png)



## Ubuntu Startup

### tp-link managed switch 

create script ```start_tplink.sh``` & 

```
#!/bin/bash
SWITCH_MANAGEMENT_URL="http://xxx.xxx.x.x" SWITCH_MANAGEMENT_STATS="PortStatisticsRpm.htm" LOGIN_FORM_DATA="username=xxxx&password=xxxx&cpassword=&logon=Login" node /home/xxxxx/tp-link-scraper/index.js
```

Allow execute permissions
```
chmod +x start_tplink.sh
```

create file ```/etc/systemd/system/managed_switch.service```

```
[Unit]
Description=ManagedSwitchUI
Wants=network-online.target
After=network-online.target

[Service]
User=xxxxx
Group=xxxxx
Type=simple
ExecStart=/home/xxxxx/tp-link-scraper/start_tplink.sh

[Install]
WantedBy=multi-user.target
```

start
```sudo systemctl [start|status|enable] managed_switch.service```


### Setup Prometous / Grahana

The program creates promethous `counter`, so you will need to chart the `rate` of change, rarther than the actual number.  The PromQL query will look like (excluded the port that links the hub to the router)

```
rate(managed_switch_RxPkt{room!="hub",}[1m])

```


## Sky Router

create script  ```start_sky.sh```
```
#!/bin/bash
ROUTER_URL="http://xxx.xxx.x.x" ROUTER_STATS_URL_AUTH="Basic *********" node /home/xxxxx/tp-link-scraper/skyscrape.js
```

Allow execute permissions
```
chmod +x start_sky.sh
```

create file ```/etc/systemd/system/sky_scraper.service```

```
[Unit]
Description=SkyScraper
Wants=network-online.target
After=network-online.target

[Service]
User=xxxxx
Group=xxxxx
Type=simple
ExecStart=/home/xxxxx/tp-link-scraper/start_sky.sh

[Install]
WantedBy=multi-user.target
```

start
```sudo systemctl [start|status|enable] sky_scraper.service```