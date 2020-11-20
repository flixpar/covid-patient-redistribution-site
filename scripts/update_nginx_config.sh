#!/bin/sh
sudo cp /home/flixpar/covid-resource-allocation-site/config/server_full.conf /etc/nginx/nginx.conf
sudo nginx -s reload