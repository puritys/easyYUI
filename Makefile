name=js/all.js

all:
	if [ -f $(name) ]; then rm $(name); fi
	touch $(name);
	cat js/translator.js >> $(name)
	cat js/lang_zh-TW.js >> $(name)
	cat js/core.js >> $(name)
	cat js/ui.js >> $(name)
	cat js/dialog.js >> $(name)
	cat js/io.js >> $(name)

