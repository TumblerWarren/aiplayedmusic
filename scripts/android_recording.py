"""Bounded shutdown of an adb screenrecord process, including unresponsive encoders."""
import subprocess


def stop_recording(process, shell):
    def remote_signal(signal):
        for pid in shell('pidof', 'screenrecord', check=False).split():
            if pid.isdecimal():
                shell('kill', '-' + str(signal), pid, check=False)

    if process.poll() is None:
        remote_signal(2)  # Let Android flush the MP4 container first.
        try:
            process.wait(timeout=8)
        except subprocess.TimeoutExpired:
            remote_signal(15)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.terminate()
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=3)
    return process.returncode
