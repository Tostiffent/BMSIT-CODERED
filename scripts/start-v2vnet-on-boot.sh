#!/bin/bash

sudo nmcli radio wifi off
sudo rfkill unblock wifi

sudo ip link set wlan0 down
sudo iw dev wlan0 set type ibss
# sudo ip link set up mtu 1532 dev wlan0
sudo ip link set wlan0 up

sudo iw dev wlan0 ibss join v2vnet 2412

# batman-adv interface to use
sudo batctl if add wlan0
sudo ifconfig bat0 mtu 1468

# Activates batman-adv interfaces
sudo ifconfig wlan0 up
sudo ifconfig bat0 up

sudo ip addr add 192.168.123.3/24 dev bat0

# Set up default routing via the node with internet access
# (Requires nameservers to be setup manually) 
sudo ip route add default via 192.168.123.2
