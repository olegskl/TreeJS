/**
 * @fileOverview This file contains a TreeJS class.
 * @author <a href="mailto:sklyanchuk@gmail.com">Oleg Sklyanchuk</a>
 * @version 0.3.2
 */

/**
 * Creates a new TreeJS object.
 * @constructor
 * @param {Object} [template] A TreeJS template. Can be set later with .setTemplate() method.
 * @param {Object} [dataset] Complete tree dataset. Can be set later with .update() method.
 * @returns {Void}
 */

function TreeJS(template, dataset) {
    
    /**
     * A character that defines hierarchy within object IDs.
     * @constant
     * @type {String}
     * @example {'foo/': {'name': 'foo'}} defines a root node "foo" (note the "/").
     * @example {'foo/bar': {'name': 'bar'}} defines a leaf "bar" within a folder "foo" (note the "/").
     */
    
    this.DIR_SEPARATOR = '/';
    
    /**
     * Holds the tree dataset.
     * @type {Object}
     * @private
     */
    
    this.data = {};
    
    /**
     * An associative array of DOM nodes, each containing either a leaf or a folder.
     * @type {Object}
     * @private
     */
    
    this.nodes = {};
    
    /**
     * Defines a sequence of nodes within the TreeJS HTML structure.
     * @type {Array}
     * @private
     */
    
    this.nodeSequence = [];

    /**
     * Lists all currently selected nodes and leaves.
     * @type {Array}
     * @private
     */
    
    this.selection = [];
    
    /**
     * A tree header object container.
     * @type {Object}
     * @private
     */
    
    this.header = null;

    /**
     * A current and default templates.
     * @type {Object}
     * @private
     */
    
    this.template = this.defaultTemplate = {
        className: 'TreeJS',
        sortColumn: 'name',
        sortOrder: 'asc',
        columns: {}
    };
    
    // Attempt to set tree template if it's available:
    if (template && this.setTemplate(template)) {
        
        // Attempt to inject dataset if it's available:
        //  - Note that the .update() method is unaccessible if there's no template
        if (dataset) {
            this.update(dataset);
        }
        
    }
}

/**
 * Default onError function.
 * 
 * Logs error message to console (if available).
 * Suggested use is to override this function
 * with your own error handling procedure.
 * 
 * @param {String} msg A message to log.
 * @returns {Void}
 */

TreeJS.prototype.onError = function(msg) {
    
    if (window.console) {
        console.log(msg);
    }
    
}

/**
 * Default onSelectionChange function.
 * 
 * Suggested use is to override this function
 * with your own selection change procedure.
 * 
 * @param {Array} selection A list of selected nodes.
 * @returns {Void}
 */

TreeJS.prototype.onSelectionChange = function(selection) {}

/**
 * Sets new template and reinitializes the tree.
 * 
 * @param {Object} template Complete and valid template object.
 *    @param {String} [template.className] A CSS class name of the TreeJS html object.
 *    @param {String} [template.sortColumn] An ID of a column by which to sort the tree.
 *    @param {String} [template.sortOrder] A column's sort order. Can be either 'asc' or 'desc'.
 *    @param {String} [template.columns] A column's sort order. Can be either 'asc' or 'desc'.
 * @returns {Boolean} True on success; False on failure.
 */

TreeJS.prototype.setTemplate = function(template) {
    
    // The template variable type must be a non-null Object:
    if (typeof template != 'object' || template == null) {
        this.onError('Unable to set template. Template variable type is invalid.');
        return false;
    }
    
    // Some template properties are optional and
    // must be reset to their default values if omitted
    
    // CSS class name must be a String:
    if (typeof template.className != 'string') {
        template.className = this.defaultTemplate.className;
    }
    
    // The .sortColumn parameter must be a String:
    //  - It's not really an issue if a column with such ID doesn't exist
    if (typeof template.sortColumn != 'string') {
        template.sortColumn = this.defaultTemplate.sortColumn;
    }
    
    // The .sortOrder parameter must be 'asc' or 'desc' (case-insensitive):
    //  - I haven't found a way to simulate PHP's in_array() function without an associative array...
    if (!template.sortOrder || !template.sortOrder.toLowerCase in {'asc':1, 'desc':1}) {
        template.sortOrder = this.defaultTemplate.sortOrder;
    }
    
    // The .columns parameter must be a non-null Object:
    if (typeof template.columns != 'object' || template.columns == null) {
        template.columns = {}
    }
    
    // We can now safely update the tree template:
    this.template = template;
    
    // Setting new template requires reinitialization of tree DOM element structure:
    // (initialization failure doesn't actually mean that setTemplate failed... or it does?)
    
    return this.init();
}

/**
 * Updates the tree with new data.
 * 
 * @param {Object} newData A valid TreeJS dataset.
 * @returns {Boolean} True on successful update; False on failure.
 */

TreeJS.prototype.update = function(newData) {
    
    // New data must be a non-null object:
    if (typeof newData != 'object' || newData == null) {
        this.onError('Unable to update tree with new data. Invalid dataset.');
        return false;
    }
    
    // Must fix missing directories (if any):
    newData = this.fixMissingDirectoriesInDataset(newData);
    
    // Iterate through existing node data:
    //  - Through none if the tree is empty.
    for (var nodeId in this.data) {
        
        // Delete nodes which no longer exist:
        if (!newData[nodeId]) {
            
            // removeNode is recursive, so if the node has children,
            // they will be removed automatically:
            this.removeNode(nodeId);
            
        } else if (newData[nodeId].toString() != this.data[nodeId].toString()) {
            
            // Update node:
            this.updateNode(nodeId, newData[nodeId]);
            delete newData[nodeId];
            
        }
        
    }
    
    for (var nodeId in newData) {
        
        // Add new node:
        //  - The .addNode() method will take care of the positioning
        this.addNode(nodeId, newData[nodeId]);
        
    }
    
    return true;
}

/**
 * Fixes missing directories in tree dataset to allow creation of trees by supplying leaf data only.
 * 
 * @private
 * @example
 *    The dataset {'foo/bar': {'name': 'bar'}} is missing a directory 'foo/';
 *    Once fixed, becomes: {'foo/': {'name': 'foo'}, 'foo/bar': {'name': 'bar'}}
 * @param {Object} dataset A dataset which probably misses some parent directories.
 * @returns {Object|Boolean} A fixed dataset; False on failure.
 */

TreeJS.prototype.fixMissingDirectoriesInDataset = function(dataset) {
    
    // The dataset argument must be a non-null Object:
    if (typeof dataset != 'object' || dataset == null) {
        this.onError('Unable to fix missing directories in the supplied dataset. The supplied dataset is invalid.');
        return false;
    }
    
    for (var nodeId in dataset) {
        
        // Break up the path in folder sequence:
        // (we remove the last item because it is either a leave name
        //  or it is empty in case we're dealing with a directory)
        var folderSequence = nodeId.split(this.DIR_SEPARATOR).slice(0, -1);
        
        // Boilerplate variable:
        var folderToCheck = '';
        
        // Check existence of folders by iterating through path chunks
        // and adding them together to form deeper-level parent folders:
        for (var i in folderSequence) {
            
            folderToCheck += folderSequence[i] + this.DIR_SEPARATOR;
            
            // Skip loop if folder exists:
            if (dataset[folderToCheck]) {
                continue;
            }
            
            // Folder does not exist, add it to the dataset:
            dataset[folderToCheck] = {
                name: folderSequence[i]
            };
            
        }
        
    }
    
    return dataset;
}

/**
 * Inserts a new node into the tree.
 * 
 * - The node will be inserted in accordance with the current sort options.
 * - If a node with given ID already exists, a .nodeUpdate() will be called and its result will be returned.
 * - If the node is an orphan - parents will be created automatically (recursive method).
 * 
 * @param {String} nodeId Valid ID (unique, non-empty string) of a node to insert.
 * @param {Object} [nodeData] Valid dataset of a node to insert.
 * @returns {Boolean} TRUE on success; FALSE on failure.
 */

TreeJS.prototype.addNode = function(nodeId, nodeData) {
    
    // Node ID must be a non-empty string:
    if (typeof nodeId != 'string' || nodeId.length == 0) {
        this.onError('Unable to add node. Node ID is invalid: ' + nodeId);
        return false;
    }
    
    // Node ID must be unique:
    if (this.nodes[nodeId]) {
        return this.updateNode(nodeId, nodeData);
    }
    
    // nodeData is optional; if not provided we must figure it out from the nodeId:
    if (!nodeData) {
        // There are two possibilities: either we're dealing with a folder or with a leaf,
        // with this in mind a node name could be either the last slice or the one before it
        var nodeNameVariants = nodeId.split(this.DIR_SEPARATOR).slice(-2,2);
        nodeData = {name: nodeNameVariants[1] || nodeNameVariants[0]};
    }
    
    // Node data must be a non-null object:
    if (typeof nodeData != 'object' || nodeData == null) {
        this.onError('Unable to add node. Node dataset is invalid.');
        return false;
    }
    
    // Before adding a node we must check the existence of its parent
    //  1. Obtain the parent node ID - the character sequence to the left of the first directory separator:
    var parentNodeId = nodeId.substr(0, nodeId.substr(0, nodeId.length - 1).lastIndexOf(this.DIR_SEPARATOR) + 1);
    
    //  2. The parent node might be the root node:
    var parentIsRoot = (parentNodeId == '' || parentNodeId == nodeId);
    
    //  3. If the parent is not root and doesn't exist - attempt to create it:
    if (!parentIsRoot && !this.nodes[parentNodeId] && !this.addNode(parentNodeId)) {
        this.onError('Unable to add node. Parent node "' + parentNodeId + '" doesn\'t exist.');
        return false;
    }
    
    // Now we can safely add the node to the tree.
    
    // Create a boilerplate entry in the tree dataset:
    this.data[nodeId] = {};
    
    // Create a boilerplate entry in the tree node container:
    this.nodes[nodeId] = {
        rowNode: document.createElement('tr'),
        cells: {}
    };
    
    if (!parentIsRoot) {
        
        // Add this node id to the list of children of the parent node:
        this.nodes[parentNodeId].children.push(nodeId);
        
        // Children of collapsed nodes must not be visible:
        if (!this.nodes[parentNodeId].isOpen) {
            this.nodes[nodeId].rowNode.style.display = 'none';
        }
    }
    
    // Now figure out what is the node type and act accordingly:
    if (this.isDir(nodeId)) {
        
        // Folders must be collapsed:
        this.nodes[nodeId].isOpen = false;
        // Boilerplate array for children:
        this.nodes[nodeId].children = [];
        // Must be styled as folder:
        this.nodes[nodeId].rowNode.className = this.template.className + '-folder';
        
        // Finally create a folder (directory):
        this._createDir(nodeId, nodeData);
        
    } else {
        
        // Must be styled as leaf:
        this.nodes[nodeId].rowNode.className = this.template.className + '-leaf';
        
        // Finally create a leaf:
        this._createLeaf(nodeId, nodeData);
        
    }
    
    // The new node must be positioned correctly within the tree:
    //  1. Update the sequence of nodes;
    //  2. Position in accordance with the updated sequence.
    return (this.updateNodeSequence() && this.updateNodePosition(nodeId));
}

/**
 * Updates position of a node in accordance with the node sequence.
 * 
 * Please note that this method doesn't perform any sorting.
 * Instead, it repositions the Tree DOM nodes in accordance
 * with the node sequence that is currently in use. You might
 * need to call .nodeSequenceUpdate() prior to using this method.
 * 
 * @param {String} nodeId An ID of a node to update.
 * @returns {Boolean} TRUE if repositioning has been successful; FALSE otherwise.
 */

TreeJS.prototype.updateNodePosition = function(nodeId) {
    
    // Node ID must be a string:
    if (typeof nodeId != 'string') {
        this.onError('Unable to update node position. Node ID is invalid.');
        return false;
    }
    
    // Node reference must exist:
    if (!this.nodes[nodeId]) {
        this.onError('Unable to update node position. Node reference not found.');
        return false;
    }
    
    // Find node position in sequence:
    for (var i = 0; i < this.nodeSequence.length; i++) {
        // When found - break loop and keep node position "i" intact:
        if (this.nodeSequence[i] == nodeId) { break; }
    }
    
    // Figure out the node in front of which we must move the original node:
    // (if none - use Null; it will be moved to the end of the container node)
    var insertBeforeNode = (this.nodeSequence[i+1] && this.nodes[this.nodeSequence[i+1]])
        ?    this.nodes[this.nodeSequence[i+1]].rowNode
        :    null;
    
    // Attempt to move the node:
    try {
        
        this.bodyNode.insertBefore(this.nodes[nodeId].rowNode, insertBeforeNode);
        return true;
        
    } catch(e) {
        
        this.onError('Failed to update node position. ' + e);
        return false;
        
    }
    
}

/**
 * Updates all cells of a node (and their references) with new data.
 * 
 * @param {String} nodeId A valid ID of a node to update.
 * @param {Object} nodeData An associative array of values to put into cells.
 * @returns {Boolean} TRUE on successful update; FALSE on failure.
 */

TreeJS.prototype.updateNode = function(nodeId, nodeData) {
    
    // Node ID must be a string:
    if (typeof nodeId != 'string') {
        this.onError('Unable to update node. Node ID is invalid.');
        return false;
    }
    
    // Node must already exist in the tree:
    if (!this.nodes[nodeId]) {
        this.onError('Unable to update node. Node reference not found.');
        return false;
    }
    
    // Node data must be a non-null object:
    if (typeof nodeData != 'object' || nodeData == null) {
        this.onError('Unable to update node. Node dataset is invalid.');
        return false;
    }
    
    // Iterate through existing cells:
    //  - If you supply more values than needed - the rest will be ignored:
    for (var columnId in this.nodes[nodeId].cells) {
        
        // Reset both the cell value and the tree dataset reference:
        //  - The update will be interrupted on at least one cell update failure (maybe not the best idea)
        if (!this.setCellValue(nodeId, columnId, nodeData[columnId])) {
            return false;
        }
        
    }
    
    // Attempt to update node sequence and the inserted node position
    // and return result of both operations:
    return (this.updateNodeSequence() && this.updateNodePosition(nodeId));
}

/**
 * Removes existing node, its children, and their references from the tree.
 * 
 * @param {String} nodeId A valid ID of a node to remove.
 * @returns {Boolean} TRUE on successful removal; FALSE on failure.
 */

TreeJS.prototype.removeNode = function(nodeId) {
    
    // Node ID must be a string:
    if (typeof nodeId != 'string') {
        this.onError('Unable to remove node. Node ID is invalid.');
        return false;
    }
    
    // Node reference must exist:
    if (!this.nodes[nodeId]) {
        this.onError('Unable to remove node. Node reference not found.');
        return false;
    }
    
    // Orphans are not allowed (I'm so cruel...)
    // so check if we're dealing with a directory
    // and if the children container is correctly defined:
    if (this.isDir(nodeId) && this.nodes[nodeId].children) {
        
        // Iterate the children of the current node:
        for (var i in this.nodes[nodeId].children) {
            this.removeNode(this.nodes[nodeId].children[i]);
        }
        
    }
    
    // We must remove the node from selection:
    this.changeSelection('remove', nodeId);
    
    // Also remove from parent's children:
    //  1. First obtain the parent node id:
    var parentNodeId = this.getParentIdOf(nodeId);
    //  2. Check if parent node id is correct (might be FALSE) and that the parent node exists:
    if (parentNodeId && this.nodes[parentNodeId]) {
        
        // The children ids are kept in a simple array,
        // so we need to iterate through it to find the one
        // corresponding to the node we are trying to remove:
        for (var i in this.nodes[parentNodeId].children) {
            if (this.nodes[parentNodeId].children[i] == nodeId) {
                delete this.nodes[parentNodeId].children[i];
                break;
            }
        }
        
    }
    
    // Get reference to the DOM element of the node container:
    var element = this.nodes[nodeId].rowNode;
    
    // Attempt to destroy the DOM element of the node container:
    if (!this._destroyElement(element)) {
        return false;
    }

    // Destroy the DOM element itself together with its reference:
    delete this.nodes[nodeId];
    delete this.data[nodeId];
    
    // Remove from node sequence:
    if (!this.updateNodeSequence()) {
        this.onError('Failed to update node sequence after node removal.');
        return false;
    }
    
    return true;
}

/**
 * Returns an ID of a parent node.
 * 
 * @param {String} nodeId A valid node ID.
 * @returns {String|Boolean} Parent node ID on success; FALSE on failure.
 */

TreeJS.prototype.getParentIdOf = function(nodeId) {
    
    return (typeof nodeId == 'string')
        ? nodeId.substr(0, nodeId.substr(0, nodeId.length-1).lastIndexOf(this.DIR_SEPARATOR) + 1)
        : false;
    
}

/**
 * (Re)sets a cell value and its reference in the tree dataset.
 * 
 * @param {String} nodeId A valid ID of a node with a cell to update.
 * @param {String} columnId A valid ID of a cell column.
 * @param {String|Number|Null} cellValue Value to put inside of the cell.
 *    Must be of 'number', 'string' type OR null OR undefined.
 *    The latter two will be converted to defaultValue if any.
 * @returns {Boolean} TRUE on success; FALSE on failure.
 */

TreeJS.prototype.setCellValue = function(nodeId, columnId, cellValue) {
    
    // The node must exist:
    if (!this.nodes[nodeId]) {
        this.onError('Unable to set cell value. Node not found.');
        return false;
    }
    
    // The cell must exist within node:
    if (!this.nodes[nodeId].cells || !this.nodes[nodeId].cells[columnId]) {
        this.onError('Unable to set cell value. Cell not found.');
        return false;
    }
    
    // Validate cell value:
    if (!typeof cellValue in {'number': 1, 'string': 1, 'undefined': 1} && cellValue != null) {
        this.onError('Unable to set cell value. Value type must be: Number, String, Null or Undefined.');
        return false;
    }
    
    // Validate data container:
    if (typeof this.data != 'object' || typeof this.data[nodeId] != 'object') {
        this.onError('Unable to set cell value. Invalid data container.');
        return false;
    }
    
    // Insert original value into the dataset:
    // (better do it now; it will be modified in next steps)
    this.data[nodeId][columnId] = cellValue;
    
    // Check if we're dealing with an empty value (null or undefined):
    if (typeof cellValue == 'undefined' || cellValue == null) {
        // Attempt to reset as defaultValue from the template or failover as empty string:
        cellValue = this.template.columns[columnId].defaultValue || '';
    }
    
    // Numbers must be converted to strings:
    cellValue = (typeof cellValue == 'number') ? cellValue.toString() : cellValue;
    
    // Check if the current template requires to escape cell value:
    // (don't trust the defaultValue in the template to be unescaped)
    cellValue = (this.template.columns[columnId].noEscape)
        ?    cellValue
        :    this._htmlSpecialChars(cellValue) || '';
    
    // Grab reference to the DOM element where the value will be inserted:
    // (also consider a special case of "name" column)
    var cellNode = (columnId == 'name')
        ?    this.nodes[nodeId].cells[columnId].selectorNode
        :    this.nodes[nodeId].cells[columnId];
    
    // Attempt to insert value into the cell node:
    try {
        
        cellNode.innerHTML = cellValue;
        return true;
        
    } catch (e) {
        
        this.onError('Failed to set cell value. ' + e);
        return false;
        
    }
    
}

/**
 * Appends the tree to a DOM element.
 * 
 * @param {Object} node A valid DOM node (nodeType = 1).
 * @returns {Boolean} TRUE on successful append; FALSE on failure.
 */

TreeJS.prototype.appendTo = function(node) {
    
    // Only append to valid DOM elements (nodeType = 1):
    if (typeof node != 'object' || node.nodeType != 1) {
        this.onError('Unable to append. Parent node is invalid.');
        return false;
    }
    
    try {
        
        node.appendChild(this.containerNode);
        return true;
        
    } catch(e) {
        
        this.onError('Failed to append. ' + e);
        return false;
        
    }
}

/**
 * Opens (unfolds) all branches.
 * 
 * @returns {Boolean} TRUE on success; FALSE if at least one branch fails to open.
 */

TreeJS.prototype.openAllBranches = function() {
    
    // Iterate through available nodes:
    for (var nodeId in this.nodes) {
        
        // Only work with folders:
        if (!this.isDir(nodeId)) {
            continue;
        }
        
        // Attempt to open branch:
        if (!this.openBranch(nodeId)) {
            this.onError('Failed to open all branches.');
            return false;
        }
        
    }
    
    return true;
}

/**
 * Closes (folds) all branches.
 * 
 * @returns {Boolean} TRUE on success; FALSE if at least one branch fails to close.
 */

TreeJS.prototype.closeAllBranches = function() {
    
    // Iterate through available nodes:
    for (var nodeId in this.nodes) {
        
        // Only work with folders:
        if (!this.isDir(nodeId)) continue;
        
        // Attempt to close branch:
        if (!this.closeBranch(nodeId)) {
            this.onError('Failed to close all branches.');
            return false;
        }
        
    }
    
    return true;
}

/**
 * Toggles a branch (opens or closes depending on its state).
 * 
 * @param {String} nodeId A valid ID of a node to toggle.
 * @returns {Boolean} TRUE on success; FALSE on failure.
 */

TreeJS.prototype.toggleBranch = function(nodeId) {
    
    // Node ID must be a string:
    if (typeof nodeId != 'string') {
        this.onError('Unable to toggle branch. Node ID is invalid.');
        return false;
    }
    
    if (!this.isDir(nodeId)) {
        this.onError('Unable to toggle branch. Target is a leaf node.');
        return false;
    }
    
    return (this.nodes[nodeId].isOpen)
        ? this.closeBranch(nodeId)
        : this.openBranch(nodeId);
}

/**
 * Opens a branch.
 * 
 * @param {String} nodeId A valid ID of a node to open.
 * @returns {Boolean} TRUE on success; FALSE on failure.
 */

TreeJS.prototype.openBranch = function(nodeId) {
    
    if (!this.isDir(nodeId)) {
        this.onError('Unable to open branch. Target is a leaf node.');
        return false;
    }

    if (typeof this.nodes != 'object' || typeof this.nodes[nodeId] != 'object') {
        return false;
    }
    
    for (var i in this.nodes[nodeId].children) {
        this.unhideBranchOrNode(this.nodes[nodeId].children[i]);
    }
    
    if (this.nodes[nodeId].rowNode.className.indexOf(' ' + this.template.className + '-branchIsOpen') == -1) {
        this.nodes[nodeId].rowNode.className += ' ' + this.template.className + '-branchIsOpen';
    }
    
    this.nodes[nodeId].isOpen = true;
    
    return true;
}

/**
 * Closes a branch.
 * 
 * Any open nodes within the closed node will remain open.
 * 
 * @param {String} nodeId A valid ID of a node to close.
 * @returns {Boolean} TRUE on success; FALSE on failure.
 */

TreeJS.prototype.closeBranch = function(nodeId) {
    
    if (!this.isDir(nodeId)) {
        this.onError('Unable to close branch. Target is a leaf node.');
        return false;
    }
    
    if (typeof this.nodes != 'object' || typeof this.nodes[nodeId] != 'object') {
        return false;
    }
    
    // Recursively hide children:
    //  - Do not close them! They are supposed to stay open, but hidden
    for (var i in this.nodes[nodeId].children) {
        this.hideBranchOrNode(this.nodes[nodeId].children[i]);
    }
    
    // Restyle the branch by modifying the CSS class:
    this.nodes[nodeId].rowNode.className = this.nodes[nodeId].rowNode.className.replace(' ' + this.template.className + '-branchIsOpen', '');
    
    this.nodes[nodeId].isOpen = false;
    
    return true;
}

/**
 * Hides a node (recursive).
 * 
 * Any open nodes within the closed node will remain open.
 * 
 * @param {String} nodeId A valid ID of a node to hide.
 * @returns {Boolean} TRUE on success; FALSE on failure.
 */

TreeJS.prototype.hideBranchOrNode = function(nodeId) {
    
    if (!this.nodes[nodeId]) {
        this.onError('Unable to hide. Node not found.');
        return false;
    }
    
    if (this.isDir(nodeId)) {
        
        for (var i in this.nodes[nodeId].children) {
            this.hideBranchOrNode(this.nodes[nodeId].children[i]);
        }
        
    }
    
    this.nodes[nodeId].rowNode.style.display = 'none';
    
    return true;
}

/**
 * Unhides (shows) a node (recursive).
 * 
 * Any closed nodes within the opened node will remain close.
 * 
 * @param {String} nodeId A valid ID of a node to hide.
 * @returns {Boolean} TRUE on success; FALSE on failure.
 */

TreeJS.prototype.unhideBranchOrNode = function(nodeId) {
    
    if (!this.nodes[nodeId]) {
        this.onError('Unable to unhide. Node "' + nodeId + '" not found.');
        return false;
    }
    
    // Apply CSS styling to unhide the node:
    this.nodes[nodeId].rowNode.style.display = 'table-row';
    
    // Check if we need to go further (dealing with a folder?):
    if (!this.isDir(nodeId) || !this.nodes[nodeId].isOpen) {
        return true;
    }
    
    // Unhide children:
    for (var i in this.nodes[nodeId].children) {
        if (!this.unhideBranchOrNode(this.nodes[nodeId].children[i])) {
            return false;
        }
    }
    
    return true;
}

/**
 * Checks if a node ID represents a directory.
 * 
 * @param {String} nodeId Valid ID of a node to check.
 * @return {Boolean} TRUE if the node is a directory; FALSE otherwise.
 */

TreeJS.prototype.isDir = function(nodeId) {
    
    // Folder IDs' last character equal the constant DIR_SEPARATOR:
    //  - "foo/", "foo/bar/" are folders
    //  - "foo", "foo/bar" are leaves
    return (typeof nodeId == 'string' && nodeId.substr(nodeId.length - 1, 1) == this.DIR_SEPARATOR);
    
}

/**
 * Updates node sequence based on tree's current dataset and sorting settings.
 * 
 * @param {String} [sortColumn] A valid ID of a tree column.
 * @param {String} [sortOrder] Sorting order: "asc" or "desc".
 * @param {Object} [newData] Optional.
 * @returns {Boolean} TRUE on successful update; FALSE otherwise.
 */

TreeJS.prototype.updateNodeSequence = function(sortColumn, sortOrder, newData)
{
    var sortColumn = (typeof sortColumn == 'string' && this.template.columns[sortColumn])
        ?    sortColumn
        :    this.template.sortColumn;
    var sortOrder = (typeof sortOrder == 'string') ? sortOrder : this.template.sortOrder;
    var newData = (typeof newData == 'undefined') ? this.data : newData;
    
    if (typeof newData != 'object' || newData == null) {
        return false;
    }
    
    var sortableData = [];
    
    for (nodeId in newData) {
        sortableData.push([nodeId, newData[nodeId][sortColumn] || null]);
    }
    
    sortableData.sort(this._customSort(sortOrder.toLowerCase() == 'desc'));
    
    this.nodeSequence = this._sortByHierarchy(sortableData);
    
    return true;
}

/* ---------------------------------------------------- SELECTION ---------------------------------------------------- */

/**
 * Modifies current list of selected nodes and triggers an .onSelectionChange() method.
 * 
 * @param {String} nodeId_firstInRange A valid ID of a first node in selection range.
 * @param {String} [nodeId_lastInRange] A valid ID of a last node in selection range.
 * @returns {Boolean} TRUE on success; FALSE on failure.
 */

TreeJS.prototype.changeSelection = function(action, nodeId_firstInRange, nodeId_lastInRange) {
    
    switch (action) {
        
        case 'add' :
            var success = this.addToSelection(nodeId_firstInRange || null);
            break;
        
        case 'remove' :
            var success = this.removeFromSelection(nodeId_firstInRange || null);
            break;
        
        case 'single' :
            var success = this.selectSingle(nodeId_firstInRange || null);
            break;
        
        case 'all' :
            var success = this.selectAll();
            break;
        
        case 'none' :
            var success = this.selectNone();
            break;
        
        case 'range' :
            var success = this.selectRange(nodeId_firstInRange || null, nodeId_lastInRange || null);
            break;
        
    }
    
    if (!success) {
        return false;
    }
    
    if (typeof this.onSelectionChange == 'function') {
        this.onSelectionChange(this.selection);
    }
    
    return true;
}

/**
 * Adds node to selection and restyles it accordingly.
 * 
 * @param {String} nodeId A valid ID of a node to add to selection.
 * @returns {Boolean} TRUE on success; FALSE on failure.
 */

TreeJS.prototype.addToSelection = function(nodeId) {
    
    // Node must exist:
    if (!this.nodes[nodeId]) {
        this.onError('Unable to add node to selection. The node does not exist.');
        return false;
    }
    
    // Do not add nodes that are already in selection:
    if (this.isSelected(nodeId)) {
        return true;
    }
    
    // Add to selection:
    this.selection.push(nodeId);
    
    // Grab reference to the node container element:
    var element = this.nodes[nodeId].rowNode;
    
    // Node container element must be a valid DOM element:
    if (typeof element != 'object' || element.nodeType != 1) {
        this.onError('Added to selection but unable to restyle node. Invalid DOM element.');
        return false;
    }
    
    // Add styling to element but avoid duplication of CSS classes:
    if (element.className.indexOf(' ' + this.template.className + '-selectedNode' == -1)) {
        element.className += ' ' + this.template.className + '-selectedNode';
    }
    
    return true;
}

/**
 * Removes node from selection and restyles it accordingly.
 * 
 * @param {String} nodeId A valid ID of a node to remove from selection.
 * @returns {Boolean} TRUE on success; FALSE on failure.
 */

TreeJS.prototype.removeFromSelection = function(nodeId) {
    
    // Node must exist:
    if (!this.nodes[nodeId]) {
        this.onError('Unable to remove node from selection. The node does not exist.');
        return false;
    }
    
    // Get node position in selection list:
    var posInSelection = this.inSelection(nodeId);
    
    // Do not deselect nodes that are not in selection:
    if (posInSelection === false) {
        return true;
    }
    
    // Remove reference from selection list property:
    this.selection.splice(posInSelection, 1);
    
    // Grab reference to the node container element:
    var element = this.nodes[nodeId].rowNode;
    
    // Node container element must be a valid DOM element:
    if (typeof element != 'object' || element.nodeType != 1) {
        this.onError('Deselected but unable to restyle node. Invalid DOM element.');
        return false;
    }
    
    var nodeClassRegex = new RegExp('\\s?' + this.template.className + '\\-selectedNode', 'gi');
    
    // Modify CSS class attribute to change styling:
    element.className = element.className.replace(nodeClassRegex, '');
    
    return true;
}

/**
 * Selects a single node and deselects the rest.
 * 
 * @param {String} nodeId A valid ID of a node to select.
 * @returns {Boolean} TRUE on success; FALSE on failure.
 */

TreeJS.prototype.selectSingle = function(nodeId) {
    
    // Node must exist:
    // (Please note that this verification is performed once again in 
    //  addToSelection, but it is important to do it here as well in order to
    //  throw an error before actually invoking selectNone!
    //  Also, there's little use to check for nodeId variable type...)
    if (!this.nodes[nodeId]) {
        this.onError('Unable to remove node from selection. The node does not exist.');
        return false;
    }
    
    // First of all deselect all nodes:
    if (!this.selectNone()) {
        this.onError('Failed to select a single element. Selection cleanup failed.');
        return false;
    }
    
    // Now reselect the node:
    if (!this.addToSelection(nodeId)) {
        this.onError('Failed to select a single element. Adding to selection failed.');
        return false;
    }
    
    return true;
}

/**
 * Selects all available nodes.
 * 
 * @returns {Boolean} TRUE on success; FALSE on failure.
 */

TreeJS.prototype.selectAll = function() {
    
    // Iterate through all available nodes:
    for (var nodeId in this.nodes) {
        
        // Attempt to add currently iterated node to selection
        // or throw an error to avoid multiple error messages:
        if (!this.addToSelection(nodeId)) {
            this.onError('Failed to add all nodes to selection.');
            return false;
        }
        
    }
    
    return true;
}

/**
 * Deselects all selected nodes.
 * 
 * @returns {Boolean} TRUE on success; FALSE on failure.
 */

TreeJS.prototype.selectNone = function() {
    
    // Iterate through current node selection list:
    //  - We're using "while" loop because node removal from selection
    //    modifies the selection array length and "for" loop messes up...
    while (this.selection.length > 0) {
        
        // Attempt to remove currently iterated node from selection
        // or throw an error to avoid infinite loop or multiple error messages:
        if (!this.removeFromSelection(this.selection[0])) {
            this.onError('Failed to remove all selected nodes from selection.');
            return false;
        }
    }
    
    return true;
}

/**
 * Handles selection click events.
 * 
 * @private
 * @param {Event} e Click event.
 * @param {String} nodeId A valid ID of a node where the click event was captured.
 * @returns {Void}
 */

TreeJS.prototype.selectionEventHandler = function(e, nodeId) {
    
    // Cross-browser event capture:
    var e = e || window.event;
    var ClickInfo = this._getClickInfo(e);
    
    if (!e || !ClickInfo) {
        this.onError('Unable to proceed with selection. Event undefined.');
        return false;
    }
    
    // Only working with left click:
    if (ClickInfo.button == 'L') {
        
        switch (ClickInfo.key) {
            
            // Selecting while Ctrl is pressed
            // adds non-selected items and removes selected ones:
            case 'ctrl' :
                this.changeSelection(this.isSelected(nodeId) ? 'remove' : 'add', nodeId);
                break;
            
            // Selecting while Shift is pressed
            // selects a range from the first item to the last:
            case 'shift' :
                this.changeSelection('range', this.selection[0] || nodeId, nodeId);
                break;
            
            // Simple selection selects one item and deselects the rest:
            default :
                this.changeSelection('single', nodeId);
            
        }
        
    }
    
    // Must not let the click bubble up:
    this._cancelBubble(e);
}

/**
 * Selects a given range of nodes and deselects the rest.
 * 
 * @param {String} startNodeId A valid ID of a node where selection will start.
 * @param {String} endNodeId A valid ID of a node where selection will end.
 * @returns {Boolean} TRUE on successful selection; FALSE on failure.
 */

TreeJS.prototype.selectRange = function(startNodeId, endNodeId) {
    
    if (!this.nodes[startNodeId]) {
        this.onError('Unable to select range. The range start node does not exist.');
        return false;
    }
    
    if (!this.nodes[endNodeId]) {
        this.onError('Unable to select range. The range end node does not exist.');
        return false;
    }
    
    // Clear up selection before selecting range:
    this.selectNone();
    
    // Figure out positions of nodes which mark the selection range edges:
    for (var nodePosInSequence in this.nodeSequence) {
        
        if (this.nodeSequence[nodePosInSequence] == startNodeId) {
            var startNodePos = parseInt(nodePosInSequence, 10);
        }
        
        if (this.nodeSequence[nodePosInSequence] == endNodeId) {
            var endNodePos = parseInt(nodePosInSequence, 10);
        }
        
    }
    
    // Handling selection from bottom to top:
    if (startNodePos > endNodePos) {
        
        var temp = endNodePos;
        
        endNodePos = startNodePos;
        startNodePos = temp;
        
    }
    
    // Finally iterate through the positions and add nodes to selection:
    for (var pos = startNodePos; pos <= endNodePos; pos++) {
        this.addToSelection(this.nodeSequence[pos]);
    }
    
    return true;
}

/**
 * Checks if a node is selected.
 * 
 * @param {String} nodeId A valid ID of a node to check.
 * @returns {Boolean} TRUE if node is selected; FALSE otherwise.
 */

TreeJS.prototype.isSelected = function(nodeId) {
    
    return (this.inSelection(nodeId) === false)
        ? false
        : true;
    
}

/**
 * Obtains position of node in selection.
 * 
 * @param {String} nodeId A valid ID of a node.
 * @returns {Integer|Boolean} Numerical position of node in selection or FALSE if not in selection.
 */

TreeJS.prototype.inSelection = function(nodeId) {
    
    // Check existence and validity of selection property:
    if (!this.selection || typeof this.selection != 'object') {
        this.onError('Unable to check if a node is selected. Selection property invalid or undefined.');
        return false;
    }
    
    // Iterate through current selecton:
    //  - Not using a "for ... in" loop because it would generate position as String
    var selection_length = this.selection.length;
    for (var position = 0; position < selection_length; position++) {
        
        if (this.selection[position] == nodeId) {
            return position;
        }
        
    }
    
    return false;
}

/* ========================= PRIVATE PROPERTIES ========================== */

TreeJS.prototype._createDir = function(nodeId, data) {
    
    for (var columnId in this.template.columns)
    {
        if (columnId == 'name') {
            
            var cell = this.nodes[nodeId].cells[columnId] = {
                containerNode: document.createElement('td'),
                expanderNode: document.createElement('a'),
                selectorNode: document.createElement('a')
            }
                
            cell.expanderNode.className = this.template.className + '-expandController -expand';
            cell.selectorNode.className = this.template.className + '-selectController';
            
            var that = this;
            
            cell.expanderNode.onclick = function(){that.toggleBranch(nodeId);that._cancelBubble();}
            
            cell.selectorNode.ondblclick = function() {that.toggleBranch(nodeId);}
            cell.selectorNode.onclick = function(e){that.selectionEventHandler(e, nodeId);}
            cell.selectorNode.onmousedown = function(){return false;}
            
            
            cell.containerNode.appendChild(cell.expanderNode);
            cell.containerNode.appendChild(cell.selectorNode);
            
            
            cell.containerNode.className = this.template.className + '-' + columnId;
            
            if (data['__className']) {
                cell.containerNode.className += ' ' + data['__className'];
            }
            
            var levelDepth = nodeId.split(this.DIR_SEPARATOR).length - 2;
            
            cell.containerNode.style.paddingLeft = (18 * levelDepth) + 'px';
            
            this.nodes[nodeId].rowNode.appendChild(cell.containerNode);
            
        } else {
            
            var cell = this.nodes[nodeId].cells[columnId] = document.createElement('td');
            cell.className = this.template.className + '-' + columnId;
            
            if (data['__className']) {
                cell.className += ' ' + data['__className'];
            }
            
            this.nodes[nodeId].rowNode.appendChild(cell);
            
        }
        
        this.setCellValue(nodeId, columnId, data[columnId]);
    }
}

TreeJS.prototype._createLeaf = function(nodeId, data)
{
    for (var columnId in this.template.columns)
    {
        if (columnId == 'name') {
            
            var cell = this.nodes[nodeId].cells[columnId] = {
                containerNode : document.createElement('td'),
                selectorNode : document.createElement('a')
            }
                
            cell.selectorNode.className = this.template.className + '-selectController';
            
            if (this.template.defaultLeafType && typeof this.template.defaultLeafType == 'string') {
                cell.selectorNode.className += ' ' + this.template.className + '-' + this.template.defaultLeafType;
            }
            
            var that = this;
            
            cell.selectorNode.onmousedown = function(){return false;}
            cell.selectorNode.onclick = function(e){that.selectionEventHandler(e, nodeId);}
            
            cell.containerNode.appendChild(this.nodes[nodeId].cells[columnId].selectorNode);
            
            var levelDepth = nodeId.split(this.DIR_SEPARATOR).length - 1;
            
            cell.containerNode.className = this.template.className + '-' + columnId;
            
            if (data['__className']) {
                cell.containerNode.className += ' ' + data['__className'];
            }
            
            cell.containerNode.style.paddingLeft = 18 + (18 * levelDepth) + 'px';
            
            this.nodes[nodeId].rowNode.appendChild(cell.containerNode);
        
        } else {
            
            var cell = this.nodes[nodeId].cells[columnId] = document.createElement('td');
            
            cell.className = this.template.className + '-' + columnId;
            
            if (data['__className']) {
                cell.className += ' ' + data['__className'];
            }
            
            this.nodes[nodeId].rowNode.appendChild(cell);
            
        }
        
        this.setCellValue(nodeId, columnId, data[columnId] || null);
    }
}


/**
 * (Re)sets a header.
 * 
 * @return {boolean}  True on success; False on failure.
 */

TreeJS.prototype.setHeader = function() {
    
    // Do not attempt to set header if it has been disabled in the template:
    // (this actually throws an error, so you need to do a template check before calling this function)
    if (this.template.disableHeader) {
        this.onError('Unable to set header. Header is marked as disabled in the template.');
        return false;
    }
    
    // The tree must have a valid container node:
    if (!this.containerNode || this.containerNode.nodeType != 1) {
        this.onError('Unable to set header. Tree not initialized or container node is missing.');
        return false;
    }
    
    // Remove and clean up header if it's been previously defined:
    if (!this.removeHeader()) {
        this.onError('Unable to set header. Failed cleaning up the obsolete header.');
        return false;
    }
    
    // Set up boilerplate:
    this.header = {
        containerNode : document.createElement('tHead'),
        rowNode : document.createElement('tr'),
        cells : {}
    }
    
    var columnPosition = 0;
    
    for (var columnId in this.template['columns']) {
        
        this._addHeaderCell(columnId, columnPosition);
        columnPosition++;
        
    }
    
    try {
        
        // Append TR to THEAD:
        this.header.containerNode.appendChild(this.header.rowNode);
        
        // Append THEAD to TABLE:
        this.containerNode.insertBefore(this.header.containerNode, this.bodyNode);
        
    } catch(e) {
        this.onError('Failed to set header. ' + e);
        return false;
    }
    
    return true;
}


/**
 * Adds a header cell.
 * 
 * @private
 * 
 * @param {string} columnId
 * @param {number} columnPosition
 * 
 * @return {boolean}  True on success; False on failure.
 */

TreeJS.prototype._addHeaderCell = function(columnId, columnPosition) {
    
    // Header must be initialized before calling this function:
    if (!this.header) {
        this.onError('Unable to add header cell. Header is not initialized.');
        return false;
    }
    
    // Set up boilerplate:
    var cell = this.header.cells[columnId] = {
        containerNode: document.createElement('th'),
        controllerNode: document.createElement('a')
    }
    
    // Figure out column title:
    var columnTitle = this.template.columns[columnId].title || 'Column ' + columnPosition;
    
    try {
    
        cell.controllerNode.title = 'Click to sort this table by ' + columnTitle;
        cell.controllerNode.innerHTML = columnTitle;
        
        var that = this;
        
        cell.controllerNode.onmousedown = function() {
            return false;
        }
        cell.controllerNode.onclick = function() {
            that.toggleSortBy(columnId);
            that._cancelBubble();
        }
        
        cell.containerNode.className = this.template.className + '-' + columnId;
        
        if (this.template.sortColumn == columnId) {
            cell.containerNode.className += ' ' + this.template.className + '-sort' + this.template.sortOrder;
        }
        
        // Append A to TH:
        cell.containerNode.appendChild(cell.controllerNode);
        
        // Append TH to TR (of THEAD):
        this.header.rowNode.appendChild(cell.containerNode);
    
    } catch(e) {
        this.onError('Failed to add header cell. ' + e);
        return false;
    }
    
    return true;
}

/**
 * Cleans up (if necessary) and rebuilds the container and header; resets all properties.
 * 
 * @return {boolean} True on success; False on failure.
 */

TreeJS.prototype.init = function() {
    
    // Clean up and destroy the table node if it has been already set:
    if (this.containerNode && !this._destroyElement(this.containerNode)) {
        return false;
    }
    
    // Remove all node references:
    this.nodes = {}
    // Reset node sequence:
    this.nodeSequence = []
    // Reset node selection:
    this.selection = []
    
    // (Re)create TBODY node:
    this.bodyNode = document.createElement('tbody');
    
    // Clicking anywhere on table body must deselect all nodes,
    // so we need to assign an selectNone action to the table body onclick event.
    // When triggered by mous click event, "this" keyword will refer to the DOM element,
    // so we need to create a reference to "this":
    var that = this;
    // Now assign the onclick function:
    this.bodyNode.onclick = function() {
        // Deselect all nodes:
        //that.selectNone();
        that.changeSelection('none');
        // Prevent event from bubbling:
        that._cancelBubble();
    }

    // (Re)create TABLE node:
    this.containerNode = document.createElement('table');
    
    // Append TBODY to TABLE:
    this.containerNode.appendChild(this.bodyNode);
    
    // Attempt to set header
    if (!this.template.disableHeader && !this.setHeader()) {
        this.onError('Failed to initialize. Header failure.');
        return false;
    }
     
     return true;
}


/**
 * Removes and cleans up tree header DOM elements and header reference object.
 * 
 * @return {boolean} True if successfuly removed (or if there was nothing to remove); False on failure.
 */

TreeJS.prototype.removeHeader = function() {
    
    // No need to proceed if header hasn't been set yet:
    if (!this.header) {
        return true;
    }
    
    // Attempt to destroy the header node:
    if (!this._destroyElement(this.header.containerNode)) {
		return false;
	}
    
    // Reset the header reference object:
    // (this clears up all the node references it contained)
    this.header = null;
    
    return true;
}


/* ========================== SORTING METHODS ========================= */

/**
 * Toggles tree node order by a specified column.
 * 
 * This property figures out sortBy and sortOrder parameters and invokes the .sortBy() property.
 * 
 * @param {String} columnId A valid ID of a column (as in tree template).
 * @returns {Boolean} TRUE on success; FALSE on failure.
 */

TreeJS.prototype.toggleSortBy = function(columnId) {
    
    // Column ID argument must be a valid string and must exist in tree template:
    if (typeof columnId != 'string' || !this.template.columns[columnId]) {
        this.onError('Unable to reorder table. Column ID is invalid or doesn\'t exist in template.');
        return false;
    }
    
    // We'll be sorting the tree by column specified in argument:
    var newSortColumn = columnId;
    
    // Figure out if caller wants to sort by the same or by another column:
    if (this.template.sortColumn == columnId) {
        
        // We're sorting by the same column,
        // so we need to toggle the sorting type (order):
        var newSortOrder = (this.template.sortOrder.toLowerCase() == 'asc')
            ? 'desc'
            : 'asc';
        
    } else {
        
        // We're sorting by another column,
        // so we need to maintain the sorting type (order):
        var newSortOrder = this.template.sortOrder;
        
    }
    
    // Finally call the actual sorting function and return its result:
    return this.sortBy(newSortColumn, newSortOrder);
}


/**
 * Reorders tree by new column and sort order parameters.
 * 
 * @param {String} sortColumn A valid ID of a column (as in tree template).
 * @param {String} [sortOrder] Sorting order ("asc" or "desc").
 * @return {Boolean} TRUE on success; FALSE on failure.
 */

TreeJS.prototype.sortBy = function(sortColumn, sortOrder) {
    
    // Mandatory sortColumn argument must be string and must exist in the current tree template:
    if (typeof sortColumn != 'string' || !this.template.columns[sortColumn]) {
        this.onError('Unable to sort. Column ID argument (sortColumn) is missing, invalid or is not found in the template.');
        return false;
    }
    
    // The sortOrder argument is optional,
    // so if not provided - we use the current sortOrder instead:
    var sortOrder = (typeof sortOrder == 'string')
        ?    sortOrder
        :    this.template.sortOrder;
    
    // Optional sortOrder argument must be string and must evaluate to "asc" or "desc" (case-insensitive):
    // (this also serves as a double-check for template.sortOrder as there are no private properties in JS)
    if (!sortOrder.toLowerCase() in {'asc': 1, 'desc': 1}) {
        this.onError('Unable to sort. Sort order argument (sortOrder) must be "asc" or "desc".');
        return false;
    }
    
    // Attempt to update node sequence according to new sorting rules:
    if (!this.updateNodeSequence(sortColumn, sortOrder)) {
        this.onError('Unable to sort. Failure in node sequence updater.');
        return false;
    }
    
    // Re-position nodes according to new sequence:
    for (var nodePositionInSequence in this.nodeSequence) {
        
        // It's easier to read this way...
        var nodeId = this.nodeSequence[nodePositionInSequence];
        
        // Try to append nodes one by one to the end of tBody:
        // (appendChild actually MOVES nodes, so no need to remove them from the DOM;
        //  it also throws exceptions, so we put it inside of a try-catch statement)
        try {
            this.bodyNode.appendChild(this.nodes[nodeId].rowNode);
        } catch(e) {
            this.onError('Sort failed when rearranging nodes. ' + e);
            return false;
        }
        
    }
    
    /* We need to reset the styling of the current header node. */
    
    // It is possible that header is disabled:
    if (this.header) {
    
        // Grab reference to the header node of the previously sorted column:
        var oldSortHeaderNode = this.header.cells[this.template.sortColumn].containerNode;
        
        // Construct a regex that will serve to search and replace the class string used for node styling:
        // (we are using a regex because the node can contain multiple classes)
        // (this solution is no perfect...)
        var oldClassName_RegExp = new RegExp('\\s?' + this.template.className + '\\-sort' + this.template.sortOrder, 'gi');

        // Clear sort styling by remove sort class from the node:
        oldSortHeaderNode.className = oldSortHeaderNode.className.replace(oldClassName_RegExp, '');
        
        // Grab reference to the header node of the new sorted column:
        var newSortHeaderNode = this.header.cells[sortColumn].containerNode;
        
        // Predefine new class name:
        // (we're adding a space in front of class name because node can has multiple classes)
        var newClassName = ' ' + this.template.className + '-sort' + sortOrder;
        
        // Now append the new class name to the node class:
        newSortHeaderNode.className += newClassName;
    
    }
    
    // Finally update tree properties:
    this.template.sortColumn = sortColumn;
    this.template.sortOrder = sortOrder;
    
    return true;
}


/**
 * Generates a sequence of nodes where directories and parent nodes appear before children and leaves.
 * 
 * @private
 * @param {Array} data List of nodes to sort hierarchicaly.
 *     Must be constructed as: [[nodeId1, fieldVal1], [nodeId2,fieldVal2], ...]
 * @param {String} level Optional node depth level (path). Used for recursion, but
 *     can also be used if you want to obtain sequence inside a specified level.
 * @param {Array} sequence Optional node sequence. Used for recursion, but
 *     can also be used to append the resulting sequence to your own sequence.
 * @returns {Array} Sequence of nodes as follows: [nodeId1, nodeId2, ...]
 */

TreeJS.prototype._sortByHierarchy = function(data, level, sequence) {
    
    // The data argument must be an array:
    // (array type evaluates as 'object' in JS; also beware of null)
    if (typeof data != 'object' || data == null) {
        this.onError('Unable to sort by hierarchy. Original node sequence is missing or invalid.');
        return false;
    }
    
    // The level argument is optional. Must be string or null if not set:
    var level = (typeof level == 'string' && level.length > 0) ? level : null;
    
    // The sequence argument is optional. Must always be an array:
    var sequence = (typeof sequence == 'object') ? sequence : [];
    
    // Iterate through data, but work with directories only:
    for (var order in data) {
        
        // Data must be constructed as: [[nodeId1, fieldVal1], [nodeId2,fieldVal2], ...]
        // if it's not - abort sorting:
        if (!data[order][0]) {
            this.onError('Unable to sort by hierarchy. Original node sequence format is invalid.');
            return false;
        }
        
        // Grab path:
        var path = data[order][0];
        
        // Figure out parent by extracting a portion of path up to last* directory separator:
        // (* please note that the path itself can be a directory, so avoid that trailing directory separator)
        var parent = path.substr(0, path.substr(0, path.length - 1).lastIndexOf(this.DIR_SEPARATOR) + 1) || null;
        
        // Only work with directories within current level:
        if (parent != level || !this.isDir(path)) continue;
        
        // Add current node to sequence:
        sequence.push(path);
        
        // We're now working with a directory
        // so we'll need to reiterate the same function
        // for all lower levels of the current directory:
        var subLevel = path.substr(0, (level == null)
            ?    path.indexOf(this.DIR_SEPARATOR) + 1
            :    path.indexOf(this.DIR_SEPARATOR, level.length) + 1
        );
        
        // Now relaunch this function for the sublevel
        var subLevelSequence = this._sortByHierarchy(data, subLevel, sequence);
        
        // Terminate if iterating sublevel fails:
        // (must be a type comparison as the routine
        //  might return an empty sequence which evaluates as false)
        if (subLevelSequence === false) {
            // There's no need to throw an error message
            // because the routine have already handled it
            // and because we'd better avoid onError multiplication.
            return false;
        }
        
        // and add the resulting sequence to the final sequence:
        sequence.concat(subLevelSequence);
    }
    
    // Iterate through data, but work with leaves only:
    for (var order in data) {
        
        /* There's no need to validate data as it was already done in the previous "for" loop... */
        
        // Grab path:
        var path = data[order][0];
        
        // Figure out parent by extracting a portion of path up to last* directory separator:
        // (* please note that the path itself can be a directory, so avoid that trailing directory separator)
        var parent = path.substr(0, path.substr(0, path.length - 1).lastIndexOf(this.DIR_SEPARATOR) + 1) || null;
        
        // Only work with leaves within current level:
        if (parent != level || this.isDir(path)) continue;
        
        // Add current node to sequence:
        sequence.push(path);
        
    }
    
    return sequence;
}


/**
 * Custom bubble sort function.
 * 
 * @private
 * @param {Boolean} reverse  If set to True - the sorting order will be reversed.
 * @returns {Integer} -1 or 0 or 1
 */

TreeJS.prototype._customSort = function(reverse) {
    
    // Figure out the reverse modifier:
    var reverse = (reverse) ? -1 : 1;
    
    return function(a, b) {
        
        // The function requires the a and b arguments to be non-null objects:
        if (typeof a != 'object' || a == null || typeof b != 'object' || b == null) {
            this.onError('Bubble sort failure. Invalid argument(s).');
            return 0;
        }
        
        var x = (typeof a[1] == 'string') ? a[1].toLowerCase() : a[1];
        var y = (typeof b[1] == 'string') ? b[1].toLowerCase() : b[1];
        
        return (x < y) ? reverse * -1 : (x > y) ? reverse : 0;
    }
}

/* ========================== UTILITY METHODS ========================== */

/**
 * Escapes HTML special characters.
 * 
 * @private
 * @param {String} stringToProcess A character sequence to escape.
 * @returns {String|Boolean} An escaped character sequence or FALSE on failure.
 */

TreeJS.prototype._htmlSpecialChars = function(stringToProcess) {
    
    // Only process strings:
    if (typeof stringToProcess != 'string') {
        return false;
    }
    
    // List of characters and their replacements:
    var chars = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        '\'': '&#039;',
        '#': '&#035;'
    }
    
    return stringToProcess.replace(/[<&>'"#]/g, function(s) { return chars[s]; });
}

/**
 * Cancels event bubbling.
 * 
 * @private
 * @param {Event} e A click event.
 * @returns {Void}
 */

TreeJS.prototype._cancelBubble = function(e) {
    
    var e = e || window.event;
    
    if (e.cancelBubble === false) e.cancelBubble = true;
    if (e.stopPropagation) e.stopPropagation();
    
}

/**
 * Obtains information about a click event.
 * 
 * @private
 * @param {Event} e A click event.
 * @returns {Object|Boolean} Information about the event; FALSE on failure.
 */

TreeJS.prototype._getClickInfo = function(e) {
    
    var e = e || window.event;
    
    if (!e) { return false; }
    
    var button = null;
    var key = null;
    
    // Checking for combination
    if (typeof(e.ctrlKey) != 'undefined') {
        
        if (e.ctrlKey) {key = 'ctrl';}
        if (e.shiftKey) {key = 'shift';}
        if (e.altKey) {key = 'alt';}
        if (e.ctrlKey && e.shiftKey) {key = 'ctrl+shift';}
        
    } else {
        
        if (e.modifiers && Event.CONTROL_MASK) {key = 'ctrl';}
        if (e.modifiers && Event.SHIFT_MASK) {key = 'shift';}
        if (e.modifiers && Event.ALT_MASK) {key = 'alt';}
        if (e.modifiers && Event.CONTROL_MASK && Event.SHIFT_MASK) {key = 'ctrl+shift';}
        
    }
    
    // Checking for mouse button
    if (e.which == null) {
        // IE case:
        button = (e.button < 2) ? 'L' : ((e.button == 4) ? 'M' : 'R');
    } else {
        // Other browsers:
        button = (e.which < 2) ? 'L' : ((e.which == 2) ? 'M' : 'R');
    }
    
    return {
        button: button,
        key: key
    };
}

/**
 * Destroys a provided DOM element.
 * 
 * @private
 * @param {String} nodeId A valid ID of a node to destroy.
 * @returns {Boolean} TRUE on successful destruction; FALSE on failure.
 */

TreeJS.prototype._destroyElement = function(element) {
    
    // Node container must be a valid DOM element:
    if (!element || element.nodeType != 1) {
        this.onError('Unable to destroy DOM element. Invalid DOM element.');
        return false;
    }
    
    try {
        
        // Remove all inner DOM structure of the element:
        // (do NOT use innerHTML because stupid IE throws a tantrum when dealing with tables)
        while(element.hasChildNodes() && element.childNodes) {
            element.removeChild(element.childNodes[0]);
        }

        // Check if the element has been appended to a parent element:
        if (element.parentNode) {
            // Remove the element from the DOM and delete the resulting reference:
            element.parentNode.removeChild(element);
        }
        
        return true;
    
    } catch (e) {
        
        this.onError('Failed to destroy DOM element. ' + e);
        return false;
        
    }
    
}