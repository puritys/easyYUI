YUI.add("easyYUI_dragDrop", function (Y) {

    var obj = {},
        attrs = {};

    obj.initializer = function () {

    };

    obj.init = function () {
        this.previewNode = null;
        if (this.lastTouchedNode) {
            this.lastTouchedNode.setData("easyYUI_isTouched", false);
        }

    };

    obj.deleteEvent = function () {
        Y.detach(this.mousemoveEvent);
        Y.detach(this.mouseupEvent);
        this.dragCanvas.addClass('hidden');
    };

    obj.dragTo = function (node, touchNodeClass, callback) {
        var dragCanvasHTML, cloneNode;
        this.startX = window.event.pageX;
        this.startY = window.event.pageY;

        this.init();
        if (!this.dragCanvas) {
            this.dragCanvas = Y.one(".easyYUI-drag-canvas");
            if (!this.dragCanvas) {
                dragCanvasHTML = '<div class="easyYUI-drag-canvas">.</div>';
                this.dragCanvas  = Y.one("body").appendChild(dragCanvasHTML);
            }
        }
        this.dragCanvas.removeClass('hidden');

        this.originNode = node;
        this.originNode.setData('easyYUI_isDrag', true);

        cloneNode = node.cloneNode(1);
        this.copyNode = Y.Node.create("<div></div>");
        this.copyNode.appendChild(cloneNode);
        
        this.originNode.addClass('easyYUI_dragOrigin');
        this.callback = callback;
        var width = node.get('offsetWidth');
        var height = node.get('offsetHeight');
        this.offsetLeft = width/2 * (-1);
        this.offsetTop = height/2 * (-1);
        this.touchParent = Y.one(touchNodeClass).ancestor();
        this.childNodes = Y.all(touchNodeClass);
        Y.one("body").append(this.copyNode);
        this.copyNode.setStyles({
            "position": "absolute", "zIndex": "999",
            "width": node.get('offsetWidth'),
            "height": node.get('offsetHeight'),
            "padding": 0
        });
        this.initBindEvent(touchNodeClass);
    };

    obj.initBindEvent = function (touchNodeClass) {
        var moveCallback, endCallback, touchCallback;
        moveCallback = Y.bind(this.nodeMove, this);
        endCallback = Y.bind(this.nodeMoveEnd, this);
        touchCallback = Y.bind(this.nodeTouch, this);

        this.mousemoveEvent = this.dragCanvas.on('mousemove', moveCallback);
        this.mouseupEvent = this.dragCanvas.on('mouseup', endCallback);

    };

    obj.nodeMove = function (E) {
        Y.log("mouse move", "debug");
        var pos = {}, mousex, mousey;
        E.halt();
        mousex = E.pageX;
        mousey = E.pageY;
        pos.left = E.pageX + this.offsetLeft;
        pos.top = E.pageY + this.offsetTop;
        this.copyNode.setStyles(pos);
        var i, n, region, position = "before";
        n = this.childNodes.size();
        for (i = 0; i < n; i++) {
            region = this.childNodes.item(i).get('region');
            if ((mousex > region.left && mousex < region.right)
                && (mousey < region.bottom && mousey > region.top)
            ) {
                if (Math.abs(E.pageX - this.startX) > Math.abs(E.pageY - this.startY)) {
                    if ((mousex - region.left) > (region.right - region.left)/2) {
                        position = "after";
                    }
                } else {
                    if ((mousey - region.bottom) > (region.top - region.bottom)/2) {
                        position = "after";
                    }

                }
                this.nodeTouch(this.childNodes.item(i), position);
                break;
            }
        }
    };

    obj.nodeMoveEnd = function (E) {
        Y.log("mouse up", "debug");
        var isSuccess = false;
        E.halt();
        this.deleteEvent();
        this.copyNode.remove();
        this.originNode.removeClass('easyYUI_dragOrigin');
        if (!this.previewNode) {
            return ;
        }
        if (this.callback) {
            if (this.callback.drop){ isSuccess = this.callback.drop();}
        }

        if (isSuccess) {
            this.originNode.remove();
            this.previewNode.removeClass('easyYUI_dragOrigin');
        } else {
            if (this.previewNode) this.previewNode.remove();
        }
    };

    obj.nodeTouch = function (touchedNode, position) {
        if (touchedNode.getData("easyYUI_isDrag")) return ;
        if (this.lastTouchedNode) {
            if (this.lastPosition == position && this.lastTouchedNode.getData("easyYUI_isTouched")) {
                return ;
            }
            this.lastTouchedNode.setData("easyYUI_isTouched", false);
        }
        touchedNode.setData("easyYUI_isTouched", true);
        this.lastTouchedNode = touchedNode;
        this.lastPosition = position;
        this.insertNode(touchedNode, position);

    };

    obj.insertNode = function (touchedNode, position) {
        if (this.previewNode) this.previewNode.remove();
        var previewNode = this.originNode.cloneNode(1);
        previewNode.setData("easyYUI_cloneNode", true);
        previewNode.removeClass("easyYUI_dragOrigin");
        this.previewNode = previewNode;
        touchedNode.insert(previewNode, position);

    };

    Y.namespace('easyYUI').dragDrop = Y.Base.create('easyYUI_dragDrop', Y.Base, [],
        obj,
        {
            ATTRS: attrs
        }
    );


    obj = null;
    attrs = null;
    
    Y.namespace('easyYUI_obj').dragDrop = new Y.easyYUI.dragDrop();
    Y.log("Load YUI Module [easyYUI dragDrop] success", "info");
}, '', {requires: ['base', 'transition', 'event-move']});
