import shutil
import glob

fns = glob.glob("../public/results-static/*.json")
maxdatestr = max([fn.split("/")[-1][:8] for fn in fns])
latestfns = [fn for fn in fns if maxdatestr in fn]

for fn in latestfns:
	shutil.copy(fn, fn.replace(maxdatestr, "latest"))
