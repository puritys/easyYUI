name=js/easyYUI.js
nameCss=css/easyYUI.css
nameYuiJS=js/yui/yui.js
.PHONY: css yui

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

yui:
	if [ -f $(nameYuiJS) ]; then rm $(nameYuiJS); fi
	touch $(nameYuiJS);
#	cat yui/build/yui/yui.js >> $(nameYuiJS)
	cat yui/build/oop/oop.js >> $(nameYuiJS)
	cat yui/build/event-custom-base/event-custom-base.js >> $(nameYuiJS)
	cat yui/build/event-custom-complex/event-custom-complex.js >> $(nameYuiJS)
	cat yui/build/intl/intl.js >> $(nameYuiJS)
	cat yui/build/event-base/event-base.js >> $(nameYuiJS)
	cat yui/build/dom-core/dom-core.js >> $(nameYuiJS)
	cat yui/build/dom-base/dom-base.js >> $(nameYuiJS)
	cat yui/build/selector-native/selector-native.js >> $(nameYuiJS)
	cat yui/build/selector/selector.js >> $(nameYuiJS)
	cat yui/build/node-core/node-core.js >> $(nameYuiJS)
	cat yui/build/dom-style/dom-style.js >> $(nameYuiJS)
	cat yui/build/event-delegate/event-delegate.js >> $(nameYuiJS)
	cat yui/build/node-event-delegate/node-event-delegate.js >> $(nameYuiJS)
	cat yui/build/pluginhost-base/pluginhost-base.js >> $(nameYuiJS)
	cat yui/build/pluginhost-config/pluginhost-config.js >> $(nameYuiJS)
	cat yui/build/node-pluginhost/node-pluginhost.js >> $(nameYuiJS)
	cat yui/build/dom-screen/dom-screen.js >> $(nameYuiJS)
	cat yui/build/node-screen/node-screen.js >> $(nameYuiJS)
	cat yui/build/node-style/node-style.js >> $(nameYuiJS)
	cat yui/build/node-base/node-base.js >> $(nameYuiJS)
	cat yui/build/event-synthetic/event-synthetic.js >> $(nameYuiJS)
	cat yui/build/event-mousewheel/event-mousewheel.js >> $(nameYuiJS)
	cat yui/build/event-mouseenter/event-mouseenter.js >> $(nameYuiJS)
	cat yui/build/event-key/event-key.js >> $(nameYuiJS)
	cat yui/build/event-focus/event-focus.js >> $(nameYuiJS)
	cat yui/build/event-resize/event-resize.js >> $(nameYuiJS)
	cat yui/build/event-hover/event-hover.js >> $(nameYuiJS)
	cat yui/build/event-outside/event-outside.js >> $(nameYuiJS)
	cat yui/build/event-touch/event-touch.js >> $(nameYuiJS)
	cat yui/build/event-move/event-move.js >> $(nameYuiJS)
	cat yui/build/event-flick/event-flick.js >> $(nameYuiJS)
	cat yui/build/event-valuechange/event-valuechange.js >> $(nameYuiJS)
	cat yui/build/event-tap/event-tap.js >> $(nameYuiJS)
	cat yui/build/array-extras/array-extras.js >> $(nameYuiJS)
	cat yui/build/attribute-core/attribute-core.js >> $(nameYuiJS)
	cat yui/build/attribute-observable/attribute-observable.js >> $(nameYuiJS)
	cat yui/build/attribute-extras/attribute-extras.js >> $(nameYuiJS)
	cat yui/build/attribute-base/attribute-base.js >> $(nameYuiJS)
	cat yui/build/attribute-complex/attribute-complex.js >> $(nameYuiJS)
	cat yui/build/base-core/base-core.js >> $(nameYuiJS)
	cat yui/build/base-observable/base-observable.js >> $(nameYuiJS)
	cat yui/build/base-base/base-base.js >> $(nameYuiJS)
	cat yui/build/base-pluginhost/base-pluginhost.js >> $(nameYuiJS)
	cat yui/build/classnamemanager/classnamemanager.js >> $(nameYuiJS)
	cat yui/build/widget-base/widget-base.js >> $(nameYuiJS)
	cat yui/build/widget-htmlparser/widget-htmlparser.js >> $(nameYuiJS)
	cat yui/build/widget-skin/widget-skin.js >> $(nameYuiJS)
	cat yui/build/widget-uievents/widget-uievents.js >> $(nameYuiJS)
	cat yui/build/widget-autohide/widget-autohide.js >> $(nameYuiJS)
	cat yui/build/base-build/base-build.js >> $(nameYuiJS)
	cat yui/build/escape/escape.js >> $(nameYuiJS)
	cat yui/build/button-core/button-core.js >> $(nameYuiJS)
	cat yui/build/button-plugin/button-plugin.js >> $(nameYuiJS)
	cat yui/build/widget-stdmod/widget-stdmod.js >> $(nameYuiJS)
	cat yui/build/widget-buttons/widget-buttons.js >> $(nameYuiJS)
	cat yui/build/widget-modality/widget-modality.js >> $(nameYuiJS)
	cat yui/build/widget-position-align/widget-position-align.js >> $(nameYuiJS)
	cat yui/build/widget-position-constrain/widget-position-constrain.js >> $(nameYuiJS)
	cat yui/build/widget-stack/widget-stack.js >> $(nameYuiJS)
	cat yui/build/panel/panel.js  >> $(nameYuiJS)
	cat yui/build/datatype-number-parse/datatype-number-parse.js >> $(nameYuiJS)
	cat yui/build/json-parse/json-parse.js >> $(nameYuiJS)











