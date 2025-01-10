sudo sysctl -w net.ipv4.ip_forward=1

if_name="eno1"

sudo iptables -t nat -A POSTROUTING -o $if_name -j MASQUERADE
sudo iptables -A FORWARD -i bat0 -o $if_name -j ACCEPT
sudo iptables -A FORWARD -i $if_name -o bat0 -m state --state RELATED,ESTABLISHED -j ACCEPT

