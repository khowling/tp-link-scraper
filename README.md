* TP-LINK Managed Switch Prometheus scraper

Scrape the port metrics from a TP-LINK managed switch and expose as a target for Prometheus.

** Ubuntu Startup

create script ```start.sh```

```
SWITCH_MANAGEMENT_URL="http://xxx.xxx.xxx.xxx" SWITCH_MANAGEMENT_STATS="PortStatisticsRpm.htm" LOGIN_FORM_DATA="username=xxxx&password=xxxx&cpassword=&logon=Login" node /home/xxxxx/tp-link-scraper/index.js
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
ExecStart=/home/xxxxx/tp-link-scraper/start.sh

[Install]
WantedBy=multi-user.target
```

start
```sudo systemctl [start|status|enable] managed_switch.service```

