jQuery.sap.declare("nw.epm.refapps.ext.shop.util.TableOperations");

sap.ui.base.Object.extend("nw.epm.refapps.ext.shop.util.TableOperations", {
	// Object holding the active sorters of a list. It is used to make sure that
	// setting a new sorter with "sort list" does not break a sort order that was
	// previously set by "grouping".
	// When the list is sorted or grouped, the list of sorters that is applied to
	// the binding is built by concatenating oGrouper and aSortList of this
	// object into one array.
	// Sorting and grouping is done according to the following rules:
	// 1. Selecting a sorter on the table adds the new sorter as the main sorter
	// to all existing sorters.
	// 2. If grouping and sorting are both set for the same attribute then the
	// direction (ascending/descending) has to be aligned.
	// The search-related attributes are public because there is no special
	// logic for setting them so they can be used directly.

	constructor: function(fnRebindTable, oDefaultSorter) {
		// Storage of the active grouping and sorting is private because
		// of their interdependency
		var sSearchTerm = "",
			oGrouper = null,
			aFilterList = [];
		var aSortList = [(oDefaultSorter) ? oDefaultSorter : new sap.ui.model.Sorter("Name", false)];
		this._rebindTable = fnRebindTable;
		this.addSorter = function(oSorter) {
			// Delete any existing sorter for the path specified
			var i = this._getSortListIndexByPath(oSorter.sPath);
			if (i !== -1) {
				aSortList.splice(i, 1);
			}
			// The latest sorter is always the "main" sorter -> add it to the
			// beginning of the array
			aSortList.unshift(oSorter);
			// Copy the sort order of the new sorter to the grouper if they
			// refer to the same path
			if (oGrouper && oGrouper.sPath === oSorter.sPath) {
				oGrouper.bDescending = oSorter.bDescending;
			}
		};
		this.setGrouping = function(oNewGrouper) {
			// If there is already a sorter for the path specified, the sorting order
			// must be the same as in the new grouper
			var i = this._getSortListIndexByPath(oNewGrouper.sPath);
			if (i !== -1) {
				aSortList[i].bDescending = oNewGrouper.bDescending;
			}
			oGrouper = oNewGrouper;
		};
		this._getSortListIndexByPath = function(sPath) {
			var i;
			for (i = 0; i < aSortList.length; i++) {
				if (aSortList[i].sPath === sPath) {
					return i;
				}
			}
			return -1;
		};
		this.removeGrouping = function() {
			oGrouper = null;
		};
		this.getGrouping = function() {
			return oGrouper;
		};
		this.getSorter = function() {
			return aSortList;
		};
		this.setFilterList = function(aNewFilterList) {
			aFilterList.length = 0;
			aFilterList = aNewFilterList;
		};
		this.addFilter = function(oFilter) {
			aFilterList.push(oFilter);
		};
		this.getFilterTable = function() {
			return (aFilterList && aFilterList.length > 0) ? aFilterList : null;
		};
		this.setSearchTerm = function(sNewSearchTerm) {
			sSearchTerm = (sNewSearchTerm && sNewSearchTerm.length > 0) ? sNewSearchTerm : "";
		};
		this.getSearchTerm = function() {
			return sSearchTerm;
		};
		this.applyTableOperations = function() {
			var aActiveSortList = [];
			if (oGrouper) {
				aActiveSortList.push(oGrouper);
			}
			if (aSortList) {
				aActiveSortList = aActiveSortList.concat(aSortList);
			}
			// sSearchTerm === "": There is no search and therefore no custom
			// parameter on the binding -> setting the sorters and filters on is
			// enough. groupHeaderFactory is called to overwrite the default
			// capitalization (no upper case) or a search was deleted -> remove
			// the custom parameter from the binding and set the active sorters.
			// sSearchTerm !== "": A new search was entered -> set the table
			// item binding with the custom parameter for search and set the
			// active sorters and filters.
			this._rebindTable(aActiveSortList, (sSearchTerm === "") ? null : {
				search: sSearchTerm
			}, aFilterList);
		};
	}
});