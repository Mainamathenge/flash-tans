terraform {
  required_version = ">= 0.14.0"
  required_providers {
    openstack = {
      source  = "terraform-provider-openstack/openstack"
      version = "~> 1.53.0"
    }
  }
}

# --- VARIABLES ---
variable "image_name" { default = "Ubuntu-24.04" }

# RECOMMENDED: Use a flavor with at least 4GB RAM (e.g., m1.medium)
# Your host has 32GB RAM, so you can afford 4GB-8GB per VM.
variable "flavor_name" { default = "ds4G" } 

variable "key_pair" { default = "flashtans-key" }
variable "public_network" { default = "public" }

# --- NODE NAMING ---
variable "master_name" { default = "k8s-master-Joseph" }
variable "worker1_name" { default = "k8s-worker-1-Bertin" }
variable "worker2_name" { default = "k8s-worker-2-Tatenda" }

# --- PROVIDER ---
provider "openstack" {}

# --- NETWORK ---
resource "openstack_networking_network_v2" "k8s_net" {
  name           = "k8s-project-network"
  admin_state_up = "true"
}

resource "openstack_networking_subnet_v2" "k8s_subnet" {
  name            = "k8s-project-subnet"
  network_id      = openstack_networking_network_v2.k8s_net.id
  cidr            = "192.168.20.0/24"
  ip_version      = 4
  dns_nameservers = ["8.8.8.8", "1.1.1.1"]
}

resource "openstack_networking_router_v2" "k8s_router" {
  name                = "k8s-project-router"
  admin_state_up      = true
  external_network_id = data.openstack_networking_network_v2.public.id
}

resource "openstack_networking_router_interface_v2" "k8s_router_interface" {
  router_id = openstack_networking_router_v2.k8s_router.id
  subnet_id = openstack_networking_subnet_v2.k8s_subnet.id
}

data "openstack_networking_network_v2" "public" {
  name = var.public_network
}

# --- SECURITY GROUPS ---
resource "openstack_networking_secgroup_v2" "k8s_sg" {
  name        = "k8s_security_group"
  description = "Kubernetes cluster security group with least-privilege access"
}

# Variable for admin IP - CHANGE THIS TO YOUR PUBLIC IP
variable "admin_ip" {
  description = "Your public IP address for SSH access (find it at https://whatismyip.com)"
  default     = "0.0.0.0/32"  # CHANGE THIS!
}

variable "authorized_network" {
  description = "Authorized network CIDR for NodePort access"
  default     = "0.0.0.0/0"  # Restrict this to your office/home network
}

# Rule: SSH - RESTRICTED TO ADMIN IP ONLY (Least Privilege)
resource "openstack_networking_secgroup_rule_v2" "ssh_rule" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 22
  port_range_max    = 22
  remote_ip_prefix  = var.admin_ip  # Only your IP can SSH
  security_group_id = openstack_networking_secgroup_v2.k8s_sg.id
  description       = "SSH access from admin IP only"
}

# Rule: HTTP
resource "openstack_networking_secgroup_rule_v2" "http_rule" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 80
  port_range_max    = 80
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.k8s_sg.id
}

# Rule: HTTPS
resource "openstack_networking_secgroup_rule_v2" "https_rule" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 443
  port_range_max    = 443
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.k8s_sg.id
}

# Rule: Kubernetes API - CLUSTER INTERNAL ONLY (Least Privilege)
resource "openstack_networking_secgroup_rule_v2" "k8s_api_rule" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 6443
  port_range_max    = 6443
  remote_group_id   = openstack_networking_secgroup_v2.k8s_sg.id  # Only cluster nodes
  security_group_id = openstack_networking_secgroup_v2.k8s_sg.id
  description       = "Kubernetes API - cluster internal only"
}

# Rule: NodePorts (30000-32767) - RESTRICTED TO AUTHORIZED NETWORK
resource "openstack_networking_secgroup_rule_v2" "nodeport_rule" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 30000
  port_range_max    = 32767
  remote_ip_prefix  = var.authorized_network  # Restrict to known networks
  security_group_id = openstack_networking_secgroup_v2.k8s_sg.id
  description       = "NodePort access from authorized network"
}

# Rule: ICMP (Ping)
resource "openstack_networking_secgroup_rule_v2" "icmp_rule" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "icmp"
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.k8s_sg.id
  description       = "ICMP for network diagnostics"
}

# Rule: Flannel VXLAN - CLUSTER INTERNAL ONLY
resource "openstack_networking_secgroup_rule_v2" "flannel_rule" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "udp"
  port_range_min    = 8472
  port_range_max    = 8472
  remote_group_id   = openstack_networking_secgroup_v2.k8s_sg.id  # Only cluster nodes
  security_group_id = openstack_networking_secgroup_v2.k8s_sg.id
  description       = "Flannel VXLAN overlay network"
}

# Rule: Kubelet API - CLUSTER INTERNAL ONLY
resource "openstack_networking_secgroup_rule_v2" "kubelet_rule" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 10250
  port_range_max    = 10250
  remote_group_id   = openstack_networking_secgroup_v2.k8s_sg.id  # Only cluster nodes
  security_group_id = openstack_networking_secgroup_v2.k8s_sg.id
  description       = "Kubelet API - cluster internal only"
}

# Rule: etcd - CLUSTER INTERNAL ONLY
resource "openstack_networking_secgroup_rule_v2" "etcd_rule" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 2379
  port_range_max    = 2380
  remote_group_id   = openstack_networking_secgroup_v2.k8s_sg.id  # Only cluster nodes
  security_group_id = openstack_networking_secgroup_v2.k8s_sg.id
  description       = "etcd server client API"
}

# --- COMPUTE INSTANCES ---

# User Data script to enable swap
locals {
  user_data = <<-EOF
    #!/bin/bash
    # Create 4GB swap file
    fallocate -l 4G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    # Adjust swappiness
    sysctl vm.swappiness=10
    echo 'vm.swappiness=10' >> /etc/sysctl.conf
  EOF
}

# 1. Master Node (Joseph)
resource "openstack_compute_instance_v2" "master" {
  name            = var.master_name
  image_name      = var.image_name
  flavor_name     = var.flavor_name
  key_pair        = var.key_pair
  security_groups = [openstack_networking_secgroup_v2.k8s_sg.name, "default"]
  user_data       = local.user_data

  network {
    uuid = openstack_networking_network_v2.k8s_net.id
  }
}

# 2. Worker 1 (Bertin)
resource "openstack_compute_instance_v2" "worker1" {
  name            = var.worker1_name
  image_name      = var.image_name
  flavor_name     = var.flavor_name
  key_pair        = var.key_pair
  security_groups = [openstack_networking_secgroup_v2.k8s_sg.name, "default"]
  user_data       = local.user_data

  network {
    uuid = openstack_networking_network_v2.k8s_net.id
  }
}

# 3. Worker 2 (Tatenda)
resource "openstack_compute_instance_v2" "worker2" {
  name            = var.worker2_name
  image_name      = var.image_name
  flavor_name     = var.flavor_name
  key_pair        = var.key_pair
  security_groups = [openstack_networking_secgroup_v2.k8s_sg.name, "default"]
  user_data       = local.user_data

  network {
    uuid = openstack_networking_network_v2.k8s_net.id
  }
}

# --- FLOATING IP ---
resource "openstack_networking_floatingip_v2" "master_fip" {
  pool = var.public_network
}

resource "openstack_networking_floatingip_associate_v2" "master_fip_assoc" {
  floating_ip = openstack_networking_floatingip_v2.master_fip.address
  port_id     = openstack_compute_instance_v2.master.network.0.port

  depends_on = [
    openstack_networking_router_interface_v2.k8s_router_interface,
    openstack_compute_instance_v2.master
  ]
}

# Floating IP for Worker 1
resource "openstack_networking_floatingip_v2" "worker1_fip" {
  pool = var.public_network
}

resource "openstack_networking_floatingip_associate_v2" "worker1_fip_assoc" {
  floating_ip = openstack_networking_floatingip_v2.worker1_fip.address
  port_id     = openstack_compute_instance_v2.worker1.network.0.port

  depends_on = [
    openstack_networking_router_interface_v2.k8s_router_interface,
    openstack_compute_instance_v2.worker1
  ]
}

# Floating IP for Worker 2
resource "openstack_networking_floatingip_v2" "worker2_fip" {
  pool = var.public_network
}

resource "openstack_networking_floatingip_associate_v2" "worker2_fip_assoc" {
  floating_ip = openstack_networking_floatingip_v2.worker2_fip.address
  port_id     = openstack_compute_instance_v2.worker2.network.0.port

  depends_on = [
    openstack_networking_router_interface_v2.k8s_router_interface,
    openstack_compute_instance_v2.worker2
  ]
}

# --- OUTPUTS ---
output "master_ip" {
  value = openstack_networking_floatingip_v2.master_fip.address
  description = "Floating IP for master node"
}

output "worker1_ip" {
  value = openstack_networking_floatingip_v2.worker1_fip.address
  description = "Floating IP for worker 1"
}

output "worker2_ip" {
  value = openstack_networking_floatingip_v2.worker2_fip.address
  description = "Floating IP for worker 2"
}

output "all_floating_ips" {
  value = {
    master  = openstack_networking_floatingip_v2.master_fip.address
    worker1 = openstack_networking_floatingip_v2.worker1_fip.address
    worker2 = openstack_networking_floatingip_v2.worker2_fip.address
  }
  description = "All floating IPs for the cluster"
}

output "node_names" {
  value = [
    openstack_compute_instance_v2.master.name,
    openstack_compute_instance_v2.worker1.name,
    openstack_compute_instance_v2.worker2.name
  ]
}
