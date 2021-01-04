import shutil
import glob

fns = glob.glob("../public/results-static/*.json")
dates = [fn.split("/")[-1][:8] for fn in fns]
dates = [d for d in dates if d.isnumeric()]
maxdatestr = max(dates)
latestfns = [fn for fn in fns if maxdatestr in fn]

for fn in latestfns:
	print(fn, "=>", fn.replace(maxdatestr, "latest"))
	shutil.copy(fn, fn.replace(maxdatestr, "latest"))

