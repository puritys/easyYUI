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
	cat js/dragDrop.js >> $(name)
	cat js/easyYUI.js >> $(name)
	cat $(name) | java -jar  /usr/local/lib/java/yuicompressor-2.4.6.jar --charset utf8 --type js -o $(name)

