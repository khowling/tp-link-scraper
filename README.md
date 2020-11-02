
# TP-LINK Managed Switch and SKY ROUTER Prometheus scraper

Scrape the metrics from a TP-LINK managed switch & a Sky Router, and expose as a target for Prometheus.

## Ubuntu Startup

### tp-link managed switch 

create script ```start_tplink.sh``` & 

```
SWITCH_MANAGEMENT_URL="http://xxx.xxx.x.x" SWITCH_MANAGEMENT_STATS="PortStatisticsRpm.htm" LOGIN_FORM_DATA="username=xxxx&password=xxxx&cpassword=&logon=Login" node /home/xxxxx/tp-link-scraper/index.js
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
ExecStart=/home/xxxxx/tp-link-scraper/start_sky.sh

[Install]
WantedBy=multi-user.target
```

start
```sudo systemctl [start|status|enable] managed_switch.service```


### Sky Router

create script  ```start_sky.sh```
```
ROUTER_URL="http://xxx.xxx.x.x" ROUTER_STATS_URL_AUTH="Basic *********" node /home/xxxxx/tp-link-scraper/skyscrape.js
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