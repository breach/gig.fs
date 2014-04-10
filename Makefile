REPORTER = dot
TIMEOUT = 20000 

clean:
	rm -rf node_modules

install: clean
	npm install

run_table:
	node table/table.js

run_store:
	node store/store.js

start_table:
	forever start -a -l ~/log.table.fvr table/table.js 

start_store:
	forever start -a -l ~/log.store.fvr store/store.js 

test:
	nodeunit test/test_*

.PHONY: clean install run_table run_store start_table start_store test
