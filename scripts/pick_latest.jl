using Glob
fns = glob("*.json", "../public/results-static/")
maxdatestr = maximum([split(fn, "/")[end][1:8] for fn in fns])
latestfns = filter(fn -> occursin(maxdatestr, fn), fns)
for fn in latestfns
	cp(fn, replace(fn, maxdatestr => "latest"))
end
