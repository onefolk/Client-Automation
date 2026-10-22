"""Wall-clock and sampled aggregate process-tree RSS, including browser children."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import psutil

def run(label,command):
    folder=Path('benchmark-results');folder.mkdir(exist_ok=True)
    start=time.monotonic();peak=0
    with (folder/(label+'.log')).open('w',encoding='utf-8') as log:
        child=subprocess.Popen(command,stdout=log,stderr=subprocess.STDOUT)
        while child.poll() is None:
            try:
                process=psutil.Process(child.pid)
                memory=0
                for item in [process]+process.children(recursive=True):
                    try: memory+=item.memory_info().rss
                    except (psutil.NoSuchProcess,psutil.AccessDenied): pass
                peak=max(peak,memory)
            except psutil.NoSuchProcess: pass
            time.sleep(0.1)
    result={'label':label,'command':command,'exit_code':child.returncode,
            'wall_seconds':round(time.monotonic()-start,3),'peak_tree_rss_mib':round(peak/1048576,2),
            'memory_method':'100ms sum of process/descendant RSS; shared pages may be counted twice'}
    (folder/(label+'.json')).write_text(json.dumps(result,indent=2))
    print(json.dumps(result))
    return child.returncode

if __name__=='__main__': sys.exit(run(sys.argv[1],sys.argv[2:]))
