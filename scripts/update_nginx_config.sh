#!/bin/sh
sudo cp /home/flixpar/maryland-patient-redistribution-site/config/server_full.conf /etc/nginx/nginx.conf
sudo nginx -s reload