#!/bin/bash

echo "[+] Installing Waydroid on K3s node..."

sudo apt update
sudo apt install -y curl ca-certificates gnupg lsb-release

echo "[+] Adding Waydroid repo..."
curl https://repo.waydro.id | sudo bash
sudo apt install -y waydroid

echo "[+] Initializing Waydroid container..."
sudo waydroid init

echo "[+] Enabling Waydroid systemd service..."
sudo systemctl enable waydroid-container
sudo systemctl start waydroid-container

echo "[+] Done. Reboot if needed."
