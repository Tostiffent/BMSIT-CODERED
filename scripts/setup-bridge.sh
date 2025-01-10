sudo ip link add name br0 type bridge
sudo ip link set br0 up

sudo ip link set wlp4s0 master br0
sudo ip link set bat0 master br0

# From now on routing must be done through br0 only, ignore bat0 and other interfaces.
# So ip address must be assigned to br0 only, not bat0
