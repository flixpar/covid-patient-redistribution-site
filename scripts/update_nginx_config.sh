#!/bin/sh
sudo cp /home/flixpar/ontario-patient-redistribution-site/config/server_full.conf /etc/nginx/nginx.conf
sudo nginx -s reload