jQuery.sap.require("sap.ui.core.mvc.Controller");
jQuery.sap.require("sap.ca.ui.model.format.AmountFormat");
jQuery.sap.require("nw.epm.refapps.ext.shop.util.formatter");

sap.ui.core.mvc.Controller.extend("nw.epm.refapps.ext.shop.view.S4_ShoppingCart", {
	_oDataModel: null,
	_oEventBus: null,
	_oHeaderButton: null,
	_sIdentity: "nw.epm.refapps.ext.shop",
	_oShoppingCartTable: null,
	_oTotalFooter: null,
	_oResourceBundle: null,
	_bRefreshAfterChange: false,

	onInit: function() {
		this._oView = this.getView();
		var oComponent = sap.ui.component(sap.ui.core.Component.getOwnerIdFor(this._oView));
		this._oDataModel = oComponent.getModel();
		this._oEventBus = oComponent.getEventBus();
		this._oShoppingCartTable = this.byId("shoppingCartTable");
		this._oTotalFooter = this.byId("totalFooter");
		this._oResourceBundle = oComponent.getModel("i18n").getResourceBundle();
		this._oRouter = oComponent.getRouter();

		// Set special column widths for phone
		var oViewElementProperties = {};
		oViewElementProperties.nameFieldWidth = (sap.ui.Device.system.phone) ? "35%" : "23%";
		oViewElementProperties.subtotalFieldWidth = (sap.ui.Device.system.phone) ? "35%" : "23%";
		this._oView.setModel(new sap.ui.model.json.JSONModel(oViewElementProperties), "viewProperties");

		this._oHeaderButton = this.byId("btnShoppingCartHeader").setType(sap.m.ButtonType.Emphasized);

		// Subscribe to event that is triggered by other screens when the ShoppingCart was changed
		this._oEventBus.subscribe(this._sIdentity, "shoppingCartRefresh", jQuery.proxy(this.onShoppingCartChanged, this));
	},

	onBeforeRendering: function() {
		// Needed for two-way binding. Without this line no change handler is called at the first change.
		this._oShoppingCartTable.getBinding("items").suspend();

		// element binding for the counter on the shopping cart button
		this._oView.bindElement({
			path: "/ShoppingCarts(-1)",
			batchGroupId: "shoppingCart",
			parameters: {
				select: "TotalQuantity"
			}
		});

		// Do the binding of the totals in the footer of the ShoppingCart table
		this._oTotalFooter.bindElement({
			path: "/ShoppingCarts(-1)",
			batchGroupId: "shoppingCart",
			parameters: {
				select: "Total,CurrencyCode"
			}
		});
	},

	// Disable the checkout button if there is invalid user input or the ShoppingCart is empty
	onUpdateFinished: function() {
		var iItemCount = this._oShoppingCartTable.getItems().length,
			bEnabled = !this._hasInvalidQuantityValues() && iItemCount > 0;
		this.byId("btnCheckOut").setEnabled(bEnabled);
		this.byId("totalFooter").setVisible(iItemCount !== 0);
	},

	// Navigate back to the previous screen
	// This function is only necessary to suppress navigation due to invalid user input
	onBack: function() {
		if (this._hasInvalidQuantityValues()) {
			return;
		}
		window.history.go(-1);
	},

	// Navigate to the product details of the selected ShoppingCartItem
	// If the screen contains invalid user input, the navigation is suppressed
	onLineItemPressed: function(oEvent) {
		if (this._hasInvalidQuantityValues()) {
			return;
		}
		this._oRouter.navTo("ProductDetails", {
			productId: encodeURIComponent(oEvent.getSource().getBindingContext().getProperty("ProductId"))
		}, false);
	},

	// Navigate to the checkout screen
	onCheckoutButtonPressed: function() {
		this._oRouter.navTo("CheckOut", {}, false);
	},

	// Change quantity for the selected ShoppingCartItem
	onQuantityChanged: function(oEvent) {
		var oInputField = oEvent.getSource(),
			oData = {};
		oData.Quantity = parseFloat(oEvent.getParameter("newValue"), 10);

		// Display an error message if the quantity is not a positive whole number
		if (isNaN(oData.Quantity) || oData.Quantity % 1 !== 0 || oData.Quantity < 0) {
			oInputField.setValueState("Error");
			this.byId("btnCheckOut").setEnabled(false);
			this._bRefreshAfterChange = true;
			return;
		}

		// Delete the ShoppingCartItem if the quantity is 0
		if (oData.Quantity === 0) {
			this._deleteShoppingCartItem(oInputField.getParent());
			return;
		}
		if (this._bRefreshAfterChange) {
			this._oDataModel.setRefreshAfterChange(true);
			this._bRefreshAfterChange = false;
		}

		// Handler for successful update
		var fnOnQuantityUpdated = function(oInputField) {
			oInputField.setValueState(); // reset error value state
			this._refreshTotals();
		};

		this._oDataModel.submitChanges({
			success: jQuery.proxy(fnOnQuantityUpdated, this, oInputField),
			error: jQuery.proxy(this.onErrorOccurred, this),
			batchGroupId: "shoppingCart"
		});
	},

	// Delete selected Shopping Cart Item
	onDeletePressed: function(oEvent) {
		this._deleteShoppingCartItem(oEvent.getParameter("listItem"));
	},

	_deleteShoppingCartItem: function(oShoppingCartItem) {
		// Handler for successful deletion
		var fnOnItemDeleted = function() {
			this._refreshTotals();
		};

		this._oDataModel.remove(oShoppingCartItem.getBindingContext().getPath(), {
			success: jQuery.proxy(fnOnItemDeleted, this),
			error: jQuery.proxy(this.onErrorOccurred, this)
		});
	},

	onErrorOccurred: function(oResponse) {
		jQuery.sap.require("nw.epm.refapps.ext.shop.util.messages");
		nw.epm.refapps.ext.shop.util.messages.showErrorMessage(oResponse);
	},

	onShoppingCartChanged: function() {
		// Refresh table content inclusive table footer
		this._oShoppingCartTable.getBinding("items").refresh();
		this._oTotalFooter.getElementBinding().refresh();
	},

	_refreshTotals: function() {
		// Refresh the total values in the table footer and on the shopping cart header button
		this._oHeaderButton.getElementBinding().refresh();
		this._oTotalFooter.getElementBinding().refresh();
	},

	_hasInvalidQuantityValues: function() {
		var iQuantityColumnIndex = this._oShoppingCartTable.indexOfColumn(this.byId("quantityColumn"));
		if (iQuantityColumnIndex === -1) {
			return false;
		}
		var i, aItems = this._oShoppingCartTable.getItems();
		for (i = 0; i < aItems.length; i++) {
			if (aItems[i].getCells()[iQuantityColumnIndex].getValueState() === "Error") {
				return true;
			}
		}
		return false;
	},

	// This method creates dialogs from the fragment name
	_createDialog: function(sDialog) {
		var oDialog = sap.ui.xmlfragment(sDialog, this);
		// switch the dialog to compact mode if the hosting view has compact mode
		jQuery.sap.syncStyleClass("sapUiSizeCompact", this._oView, oDialog);
		this._oView.addDependent(oDialog);
		return oDialog;
	},

	// this handler opens the Jam/Share dialog with an Action Sheet containing the standard "AddBookmark" button
	onSharePressed: function(oEvent) {
		var oShareButton = oEvent.getSource(),
			oBtnAddBookmark = null;

		if (!this._oShareDialog) {
			this._oShareDialog = this._createDialog("nw.epm.refapps.ext.shop.view.fragment.ShareSheet");
			oBtnAddBookmark = sap.ui.getCore().byId("btnAddBookmark", this._oShareDialog.getId());
			oBtnAddBookmark.setAppData({
				url: document.URL,
				title: this._oResourceBundle.getText("xtit.myShoppingCart")
			});
		}
		this._oShareDialog.openBy(oShareButton);
	}
});