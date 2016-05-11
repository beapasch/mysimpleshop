jQuery.sap.require("sap.ui.core.mvc.Controller");
jQuery.sap.require("sap.ca.ui.model.format.AmountFormat");
jQuery.sap.require("nw.epm.refapps.ext.shop.util.formatter");

sap.ui.core.mvc.Controller.extend("nw.epm.refapps.ext.shop.view.S5_CheckOut", {
    _oEventBus : null,
    _sIdentity : "nw.epm.refapps.ext.shop",
    _oCheckOutTable : null,
    _fnRefreshBinding : null,

    onInit : function() {
        this._oView = this.getView();
        var oComponent = sap.ui.component(sap.ui.core.Component.getOwnerIdFor(this._oView));
        this._oResourceBundle = oComponent.getModel("i18n").getResourceBundle();
        this._oRouter = oComponent.getRouter();
        // Use 'local' event bus of component for communication between views
        this._oEventBus = oComponent.getEventBus();
        this._oCheckOutTable = this.byId("checkOutTable");
        this._fnRefreshBinding = jQuery.proxy(this.refreshBinding, this);

        // element binding for the counter on the shopping cart button
        this._oView.bindElement({
            path : "/ShoppingCarts(-1)",
            batchGroupId : "checkOut",
            parameters : {
                select : "FormattedCustomerName,FormattedAddress,Total,CurrencyCode,TotalQuantity"
            }
        });
        
        // Get Context Path for S5 Screen
        this._oRouter.attachRoutePatternMatched(this._onRoutePatternMatched, this);

        // Trigger a refresh of the shopping cart if the event is raised
        this._oEventBus.subscribe(this._sIdentity, "shoppingCartRefresh", this._fnRefreshBinding);
    },

    onExit : function() {
        this._oEventBus.unsubscribe(this._sIdentity, "shoppingCartRefresh", this._fnRefreshBinding);
    },

    // Check matched Route
    _onRoutePatternMatched : function(oEvent) {
        if (oEvent.getParameter("name") === "CheckOut") {
            this.byId("btnBuyNow").setEnabled(true);
        }
    },

    // Navigate to the shopping cart screen
    onShoppingCartPressed : function() {
        this._oRouter.navTo("ShoppingCart", {}, false);
    },

    // Call a function import to submit the order
    onBuyNowPressed : function(oEvent) {
     // Disable the button so that the user cannot press it a second time
        this.byId("btnBuyNow").setEnabled(false);
        
        oEvent.getSource().getModel().callFunction("/BuyShoppingCart", {
            method : "POST",
            async : true,
            success : jQuery.proxy(this.onCartSrvSuccess, this),
            error : jQuery.proxy(this.onCartSrvError, this)
        });   
    },

    // Refresh the view binding if the ShoppingCart was changed (for example, a new item was added)
    refreshBinding : function() {
    	this.byId("btnCheckOutHeader").getElementBinding().refresh();
        this._oCheckOutTable.getBinding("items").refresh();
    },

    // Service Error handling
    onCartSrvError : function(oResponse) {
        jQuery.sap.require("nw.epm.refapps.ext.shop.util.messages");
        nw.epm.refapps.ext.shop.util.messages.showErrorMessage(oResponse);
        this.byId("btnBuyNow").setEnabled(true);
    },

    // Go back to S2 and display a message toast that the shopping cart was ordered successfully
    onCartSrvSuccess : function() {
        jQuery.sap.require("sap.m.MessageToast");
        this.byId("btnBuyNow").setEnabled(true);
        this._oEventBus.publish(this._sIdentity, "shoppingCartRefresh");
        this._oRouter.navTo("ProductList", {}, false);
        sap.m.MessageToast.show(this._oResourceBundle.getText("ymsg.checkOut"));
    },
    
    onNavBack : function() {
        window.history.go(-1);
    },
    
    // This method creates dialogs from the fragment name
    _createDialog : function(sDialog) {
        var oDialog = sap.ui.xmlfragment(sDialog, this);
        // switch the dialog to compact mode if the hosting view has compact mode
        jQuery.sap.syncStyleClass("sapUiSizeCompact", this._oView, oDialog);
        this._oView.addDependent(oDialog);
        return oDialog;
    },
    
    // this handler opens the Jam/Share dialog with an Action Sheet containing the standard "AddBookmark" button
    onSharePressed : function(oEvent) {
        var oShareButton = oEvent.getSource();
        var oBtnAddBookmark = null;

        if (!this._oShareDialog) {
            this._oShareDialog = this._createDialog("nw.epm.refapps.ext.shop.view.fragment.ShareSheet");
            oBtnAddBookmark = sap.ui.getCore().byId("btnAddBookmark", this._oShareDialog.getId());
            oBtnAddBookmark.setAppData({
                url : document.URL,
                title : this._oResourceBundle.getText("xtit.checkout")
            });
        }
        this._oShareDialog.openBy(oShareButton);
    }
});
