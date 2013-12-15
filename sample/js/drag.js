
YUI.add("sampleDrag", function (Y) {

    var nodes = y.one('.box-wrap');
    nodes.delegate('mousedown', setDragSample, '.box');

    function setDragSample(E) {
        var node;
        if (E.button !=1 ) { return ;}

        E.halt();
        node = E.currentTarget;
        y.dragTo(node, '.box', {drop: drop});
    }

    function drop() {
        return true;
    }

});
