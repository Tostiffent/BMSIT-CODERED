#!/bin/bash

sudo nmcli radio wifi off
sudo rfkill unblock wifi

if_name="wlx000f6009b25f"

sudo ip link set $if_name down
sudo iw dev $if_name set type ibss
# sudo ip link set up mtu 1532 dev $if_name 
sudo ip link set $if_name up

sudo iw dev $if_name ibss join v2vnet 2412

# batman-adv interface to use
sudo batctl if add $if_name 
sudo ifconfig bat0 mtu 1468

# Activates batman-adv interfaces
sudo ifconfig $if_name up
sudo ifconfig bat0 up

sudo ip addr add 192.168.123.2/24 dev bat0

