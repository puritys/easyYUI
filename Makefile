name=js/easyYUI.js
nameCss=css/easyYUI.css

.PHONY: css

all:
	if [ -f $(name) ]; then rm $(name); fi
	touch $(name);
	cat js/yui/yui-min.js >> $(name)
	cat js/yui/yui.js >> $(name)
	cat js/translator.js >> $(name)
	cat js/lang_zh-TW.js >> $(name)
	cat js/core.js >> $(name)
	cat js/ui.js >> $(name)
	cat js/dialog.js >> $(name)
	cat js/io.js >> $(name)
	cat js/dragDrop.js >> $(name)
	cat js/easyYUI_main.js >> $(name)
	cat $(name) | java -jar  /usr/local/lib/java/yuicompressor-2.4.6.jar --charset utf8 --type js -o $(name)
	gmake css

css:
	if [ -f $(nameCss) ]; then rm $(nameCss); fi
	touch $(nameCss);
	cat css/yui/yui.css >> $(nameCss)
	cat css/easyYUI_main.css >> $(nameCss)
	cat $(nameCss) | java -jar  /usr/local/lib/java/yuicompressor-2.4.6.jar --charset utf8 --type css -o $(nameCss)

