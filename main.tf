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
  description = "Allow SSH, HTTP, K8s API, and NodePorts"
}

# Rule: SSH
resource "openstack_networking_secgroup_rule_v2" "ssh_rule" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 22
  port_range_max    = 22
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.k8s_sg.id
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

# Rule: Kubernetes API
resource "openstack_networking_secgroup_rule_v2" "k8s_api_rule" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 6443
  port_range_max    = 6443
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.k8s_sg.id
}

# Rule: NodePorts (30000-32767)
resource "openstack_networking_secgroup_rule_v2" "nodeport_rule" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 30000
  port_range_max    = 32767
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.k8s_sg.id
}

# Rule: ICMP (Ping)
resource "openstack_networking_secgroup_rule_v2" "icmp_rule" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "icmp"
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = openstack_networking_secgroup_v2.k8s_sg.id
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

# --- OUTPUTS ---
output "master_ip" {
  value = openstack_networking_floatingip_v2.master_fip.address
}

output "node_names" {
  value = [
    openstack_compute_instance_v2.master.name,
    openstack_compute_instance_v2.worker1.name,
    openstack_compute_instance_v2.worker2.name
  ]
}
