jQuery.sap.require("sap.ui.core.mvc.Controller");
//
sap.ui.core.mvc.Controller.extend("nw.epm.refapps.ext.shop.view.EmptyPage", {

	onBackPressed: function() {
		this._oComponent = sap.ui.component(sap.ui.core.Component.getOwnerIdFor(this.getView()));
		this._oRouter = this._oComponent.getRouter();
		this._oRouter.navTo("ProductList", {});
	}
});