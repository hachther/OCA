from . import models

def _pre_init_mesomb(cr):
    import subprocess
    import sys
    print('fisher rbink')
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'pymesomb'])
