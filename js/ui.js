YUI.add("easyYUI_ui", function (Y) {

    var obj = {},
        attrs = {};





    /*#############################################
    ###                Method start             ###
    #############################################*/
    obj.scrollHeight = 0;
    obj.scrollDirection = 0;
    obj.scrollTimer = null;

    /**
    * initializer
    *
    * @method initializer
    * @param {Node} elm element
    */
    obj.initializer = function () {
        this.core = Y.easyYUI.core;
        this.clickedNode = '';
        this.clickedOverlay = '';

    };

    /**
    * Create a overlay to cover whole page
    *
    * @method renderMask
    * @param {Node} elm element
    */
    obj.renderMask = function (type) {
        if (type && type == "simple") {
            Y.one(document.body).append('<div class="easyYUI_mask simple-mask"></div>');
        } else {
            Y.one(document.body).append('<div class="easyYUI_mask page-mask"></div>');
        }
    };

    obj.removeMask = function (type) {
        var node;
        node = Y.one('.easyYUI_mask');
        if (node) {
            node.remove();
        }
    };



    /**
    * Create a white overlay to cover a layer.
    * If type = btn , it will create a overlay to cover button.
    * If type = page, it will create a overlay to cover whole page.
    * If type = div, it will create a div inside the node which you point. The new div'position is controlled by css, no matter how window size change, It will always cover the node fixedly.
    *
    * @method renderLoading
    * @param {String} type page,btn,div
    * @param {Node} elm element
    */
    obj.renderLoading = function (type, node) {//{{{
        var overlay, div;
        var width, height;
        var attrs = {
            headerContent:"",
            bodyContent: '', // Didn't need loading  '<div class="loading"></div>',
            footerContent:"",
            centered: true
        };

        if (type === 'page') {
            this.renderMask();
            overlay = new Y.Overlay(attrs);
            overlay.render("body");

        } else if (type === 'btn') {
            if (!node) {
                Y.log("Node is missing, when I try to render loading div." , "error");
            }
            width = node.get('offsetWidth'); 
            height = node.get('offsetHeight');
            attrs.width = width;
            attrs.height = height;
            overlay = new Y.Overlay(attrs);
            overlay.render("body");
            overlay.align(node, [Y.WidgetPositionAlign.TL, Y.WidgetPositionAlign.TL]);
            overlay.get("boundingBox").addClass('btn-mask');
        }
/* else if (type === 'div') {
            if (!node) {
                Y.log("Node is missing, when I try to render loading div." , "error");
            }
            div = Y.Node.create('<div class="div-mask"></div>');
            //set style in css
            node.appendChild(div);
        }*/

        this.clickedOverlay = overlay;
        return overlay;
    };//}}}

    /**
    * Disable the button and create a mask to cover it.
    * If you want to create page mask , Just to set type = page
    *
    * @method preventDoubleClick
    * @param {Node} elm element
    */
    obj.preventDoubleClick = function (node, type) {//{{{
        var overlay;
        this.clickedNode = node;
        node.setAttribute('disabled', true);
        if (!type) {
            type = 'page';
        }
        overlay = this.renderLoading(type, node);
        return {buttonNode: node, loadingLayer: overlay}
    };//}}}

    /**
    * Remove the layer which created by method preventDoubleClick 
    *
    * @method preventDoubleClose
    * @param {Node} elm element
    */
    obj.preventDoubleClose = function (overlay, node) {//{{{
        var mask;
        if (node) {
            node.removeAttribute('disabled');
        }

        mask = Y.one('.page-mask');
        if(mask) {
            mask.remove();
        }
        if(overlay) {
            overlay.destroy();
        } 

/*else if (this.clickedOverlay) {
            this.clickedOverlay.destroy();
        }
        this.clickedOverlay = null;
        this.clickedNode = null;*/
    };//}}}


    /**
    * Remove the node after x seconds
    *
    * @method deleteNodeLater
    * @param {Node} which node need to hide.
    * @param {Int} How many ms will to execute.(millisecond)
    * @param {args} {deleteStart: CallBack function, deleteEnd: callback function}
    *
    * @return {reference} timer If you need to cancel this event. save this reference of timer
    */
    obj.deleteNodeLater = function (node, ms, args) {
        var trigger, time, timer;
        if (args && args.deleteStart) {
            trigger = args.deleteStart;
        } else {
            trigger = Y.bind(this.handleDeleteNode, this, node);
        }
        if (ms) {
            time = ms;
        } else {
            time = this.core.get('timeToExecute');
        }
        timer = Y.later(time, this, trigger, args);
        return timer;
    };

    /**
    * Remove the node with fantastic animation
    * When we start to remove. We need disable all button first.
    *
    * @method deleteNodeLater
    * @param {Node} which node need to hide.
    * @param {Int} duration How many ms will to execute.(millisecond)
    */
    obj.deleteNode = function (node, duration, args) {
        var dur, callBack;

        if (args && args.deleteEnd) {
            callBack = args.deleteEnd;
        } else {
            callBack = Y.bind(this.deleteNodeEnd, this, node);
        }
        if (duration) {
            dur = duration;
        } else {
            dur = this.core.get('durationToFinish');
        }
        node.all('input, select, button, a').setAttribute('disabled', true);
        Y.one(node).transition({
            duration: dur/1000,
            opacity: {
                delay: 0,
                value: 0
            }   
        }, callBack);

    };

    /**
    * The end of animation.
    *
    * @method deleteNodeLater
    * @param {Node} which node need to hide.
    * @param {Int} duration How many ms will to execute.(millisecond)
    */
    obj.deleteNodeEnd = function (node) {
        node.remove();
    };

    /**
    * handle parameter of delete Node start
    *
    * @method handleDeleteNode
    * @param {Node} which node need to hide.
    * @param {Args} 
    */
    obj.handleDeleteNode = function (node, args) {
        var duration = null;
        this.deleteNode(node, duration, args);
        
    };


    obj.scrollY = function (tNode, config) {
        var paddingTop = 0, isAnimated = true, anim;

        if (typeof(config.isAnimated) != "undefined") isAnimated = config.isAnimated;
        if (config.paddingTop) paddingTop = config.paddingTop;

        if (this.scrollTimer) this.scrollTimer.cancel();
        var h, realScrollY;
        realScrollY = tNode.getY() - paddingTop;
        h = Math.abs(Y.DOM.docScrollY() - realScrollY);

        this.scrollHeight = h;
        this.scrollDirection = Y.DOM.docScrollY() > realScrollY ? -1 : 1;
        if (isAnimated != true) {
            scrollBy(0, (this.scrollDirection) * this.scrollHeight);
            return ;
        }

        anim = Y.bind(this.scrollYAnim, this);
        this.scrollTimer = Y.later(15, this, anim, null, true);
    };

    obj.scrollYAnim = function () {
        var scrollDelta, deltaPercentage = 0.15;
        scrollDelta = Math.ceil(deltaPercentage * this.scrollHeight);
        scrollBy(0, Math.ceil(this.scrollDirection * scrollDelta));
        this.scrollHeight -= scrollDelta;
        if (this.scrollHeight <= 0) {
            this.scrollTimer.cancel();
        }
    };

    Y.namespace('easyYUI').ui = Y.Base.create('easyYUI_ui', Y.Base, [],
        obj,
        {
            ATTRS: attrs
        }
    );

    obj = null;
    attrs = null;
    
    Y.namespace('easyYUI_obj').ui = new Y.easyYUI.ui();
    Y.log("Load YUI Module [easyYUI ui] success", "info");
}, '', {requires: ['base', 'overlay', 'transition']});
