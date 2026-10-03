# Runs once at power-up, before code.py. Renames the USB drive so two Trinkeys on one Mac are not both
# CIRCUITPY. Takes effect after the next reset.
import storage
storage.remount("/", readonly=False)
storage.getmount("/").label = "ROTARYPY"
storage.remount("/", readonly=True)
