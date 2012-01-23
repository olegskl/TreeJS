TreeJS
=====

A framework-agnostic, javascript-enabled hierarchical table.

Functionality
-------------

* Nodes (folders) and leaves (items) are inserted and removed in accordance with current sort settings
* Single and multiple selection (use shift-click for range selection and ctrl-click to add or remove items)
* An onSelectionChange hook (treats range selection as a single event)
* Sorting by column (folders are always on top)
* etc.

Usage
-----

    var Tree = new TreeJS(template, dataset);
	
    Tree.appendTo(document.body);

You can also perform updates of an already rendered table

    Tree.update(newDataset);