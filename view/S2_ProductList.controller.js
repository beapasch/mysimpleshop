jQuery.sap.require("sap.ui.core.mvc.Controller");
jQuery.sap.require("nw.epm.refapps.ext.shop.util.ProductListGroupingHelper");
jQuery.sap.require("nw.epm.refapps.ext.shop.control.RatingAndCount");
jQuery.sap.require("sap.ca.ui.model.format.AmountFormat");
jQuery.sap.require("sap.m.TablePersoController");
jQuery.sap.require("nw.epm.refapps.ext.shop.util.TableOperations");
jQuery.sap.require("nw.epm.refapps.ext.shop.util.formatter");

sap.ui.core.mvc.Controller.extend("nw.epm.refapps.ext.shop.view.S2_ProductList", {
	_oEventBus: null,
	_oCatalog: null,
	// _oItemTemplate : null, // used for searching
	_oResourceBundle: null,
	_sIdentity: "nw.epm.refapps.ext.shop",
	_oTablePersoController: null,
	_oActionSheet: null,
	_oSortDialog: null,
	_oFilterData: null,

	onInit: function() {
		this._oView = this.getView();
		var oItemTemplate = this.byId("columnListItem").clone();
		this._oComponent = sap.ui.component(sap.ui.core.Component.getOwnerIdFor(this._oView));
		this._oResourceBundle = this._oComponent.getModel("i18n").getResourceBundle();
		this._oRouter = this._oComponent.getRouter();
		// Use 'local' event bus of component for communication between views
		this._oEventBus = this._oComponent.getEventBus();
		this._oCatalog = this.byId("catalogTable");
		this._oHeaderButton = this.byId("btnProductListHeader");

		// Prepare the personalization service for the product table
		this._initPersonalization();

		// Sorting and grouping on the product table follows a certain logic, which is outsourced to a helper class 1.
		// Selecting a sorter on the table adds the new sorter as the main sorter to all existing sorters 2. If grouping
		// and sorting are both set for the same attribute then the direction (ascending/descending) has to be aligned
		// The actual updating of the List Binding is done by the call back method which is handed over to the
		// constructor.
		var that = this;
		this._oTableOperations = new nw.epm.refapps.ext.shop.util.TableOperations(function(aSorter, oCustomSearch,
			aFilter) {
			var sSelect = "StockQuantity,Id,ImageUrl,Name,Description,AverageRating,RatingCount,Price,";
			sSelect += "CurrencyCode,IsFavoriteOfCurrentUser,MainCategoryName,SubCategoryName,SupplierName";

			that._oCatalog.bindAggregation("items", {
				path: "/Products",
				batchGroupId: "productList",
				sorter: aSorter,
				groupHeaderFactory: function(oGroup) {
					return new sap.m.GroupHeaderListItem({
						title: oGroup.text,
						upperCase: false
					});
				},
				parameters: {
					countMode: "Inline",
					select: sSelect,
					custom: oCustomSearch
				},
				template: oItemTemplate,
				filters: aFilter || []
			});

			//that.refreshListTitle();
		});

		this._oGrouping = new nw.epm.refapps.ext.shop.util.ProductListGroupingHelper(this._oTableOperations,
			this._oView);

		this._initViewPropertiesModel();

		// refresh the item count of the list title whenever the binding changes
		this._oCatalog.attachUpdateFinished(this.refreshListTitle, this);
		// };
	},

	// The model created here is used to set values or view element properties that cannot be bound
	// directly to the OData service. Setting view element attributes by binding them to a model is preferable to the
	// alternative of getting each view element by its ID and setting the values directly because a JSon model is more
	// robust if the customer removes view elements (see extensibility).
	_initViewPropertiesModel: function() {
		var oViewElemProperties = {};
		oViewElemProperties.catalogTitleText = this._oResourceBundle.getText("xtit.products");
		if (sap.ui.Device.system.phone) {
			oViewElemProperties.availabilityColumnWidth = "80%";
			oViewElemProperties.pictureColumnWidth = "5rem";
			oViewElemProperties.btnColHeaderVisible = true;
			oViewElemProperties.searchFieldWidth = "100%";
			oViewElemProperties.catalogTitleVisible = false;
			oViewElemProperties.ratingColumnVisible = false;
			// in phone mode the spacer is removed in order to increase the size of the search field
			this.byId("tableToolbar").removeContent(this.byId("toolbarSpacer"));
		} else {
			oViewElemProperties.availabilityColumnWidth = "18%";
			oViewElemProperties.pictureColumnWidth = "9%";
			oViewElemProperties.btnColHeaderVisible = false;
			oViewElemProperties.searchFieldWidth = "30%";
			oViewElemProperties.catalogTitleVisible = true;
			oViewElemProperties.ratingColumnVisible = true;
			if (sap.ui.Device.system.tablet) {
				oViewElemProperties.ratingColumnVisible = false;
			}
		}
		this._oViewProperties = new sap.ui.model.json.JSONModel(oViewElemProperties);
		this._oView.setModel(this._oViewProperties, "viewProperties");
	},

	// The list title displays the number of list items. Therefore the number has to be updated each
	// time the list changes. Note: the list binding returns the number of items matching the current filter criteria
	// even if the growing list does not yet show all of them. This method is also used by the smart filter bar subview.
	refreshListTitle: function() {
		// on phones the list title is not shown -> nothing needs to be done
		if (sap.ui.Device.system.phone) {
			return;
		}
		var iItemCount;
		var oBinding = this._oCatalog.getBinding("items");
		if (!oBinding) {
			return;
		} else {
			iItemCount = oBinding.getLength();
			this._oViewProperties.setProperty("/catalogTitleText", (iItemCount ? this._oResourceBundle.getText(
				"xtit.productsAndCount", [iItemCount]) : this._oResourceBundle.getText("xtit.products")));
		}
	},

	// --- Shopping Cart Handling
	onShoppingCartPressed: function() {
		this._oRouter.navTo("ShoppingCart", {}, false);
	},
	// This handler function is called when adding a new item to the shopping cart was unsuccessful
	_onCartSrvError: function(oResponse) {
		jQuery.sap.require("nw.epm.refapps.ext.shop.util.messages");
		nw.epm.refapps.ext.shop.util.messages.showErrorMessage(oResponse);
	},

	// This handler function is called when a new item was successfully added to the shopping cart. The components
	// event bus is used to notify the other screens (S3_ProductDetails, S4_ShoppingCart, S5_CheckOut) so that they can
	// read the new item's data from the back end.
	_onCartSrvSuccess: function(oEvent) {
		jQuery.sap.require("sap.m.MessageToast");
		var oModel = this._oComponent.getModel();
		var sKey = oModel.createKey("/Products", {
			Id: oEvent.ProductId
		});
		var sProductName = oModel.getProperty(sKey).Name;
		sap.m.MessageToast.show(this._oResourceBundle.getText("ymsg.addProduct", [sProductName]));
		this._oEventBus.publish(this._sIdentity, "shoppingCartRefresh");
		this._oHeaderButton.getElementBinding().refresh();
	},

	// --- List Handling

	// This method creates dialogs from the fragment name
	_createDialog: function(sDialog) {
		var oDialog = sap.ui.xmlfragment(sDialog, this);
		// switch the dialog to compact mode if the hosting view has compact mode
		jQuery.sap.syncStyleClass("sapUiSizeCompact", this._oView, oDialog);
		this._oView.addDependent(oDialog);
		return oDialog;
	},
	// When an item is added to the shopping cart, this method triggers the service call to the back end.
	// Using a function import, the back end then creates a shopping cart if none exists yet, or
	// adds a new shopping cart item to an existing cart, or updates an existing item if the added
	// product is already in the shopping cart
	onAddToCartPressed: function(oEvent) {
		this._oComponent.getModel().callFunction("/AddProductToShoppingCart", {
			method: "POST",
			urlParameters: {
				ProductId: oEvent.getSource().getBindingContext().getObject().Id
			},
			success: jQuery.proxy(this._onCartSrvSuccess, this),
			error: jQuery.proxy(this._onCartSrvError, this)
		});
	},

	// Handler method for the table search. The actual coding doing the search is outsourced to the reuse library
	// class TableOperations. The search string and the currently active filters and sorters are used to
	// rebind the product list items there. Why rebind instead of update the binding? -> see comments in the helper
	// class
	onSearchPressed: function() {
		var sSearch = this.byId("searchField").getValue();
		this._oTableOperations.setSearchTerm(sSearch);
		this._oTableOperations.applyTableOperations();
	},

	// This is the handler method of the list toolbar's overflow button. This button is only visible on
	// phones and starts the action sheet containing the sort and group that are not
	// displayed individually in phone mode.
	onOverflowPressed: function(oEvent) {
		if (!this._oActionSheet) {
			this._oActionSheet = this._createDialog("nw.epm.refapps.ext.shop.view.fragment.ProductListOverflow");
		}
		this._oActionSheet.openBy(oEvent.getSource());
	},

	onGroupPressed: function() {
		this._oGrouping.openGroupingDialog();
	},

	onSortPressed: function() {
		if (!this._oSortDialog) {
			this._oSortDialog = this._createDialog("nw.epm.refapps.ext.shop.view.fragment.ProductSortDialog");
		}
		this._oSortDialog.open();
	},

	// Handler for the Confirm button of the sort dialog. Depending on the selections made on the sort
	// dialog, the respective sorters are created and stored in the _oTableOperations object.
	// The actual setting of the sorters on the binding is done by the callback method that is handed over to
	// the constructor of the _oTableOperations object.
	onSortDialogConfirmed: function(oEvent) {
		var mParams = oEvent.getParameters(),
			sSortPath = mParams.sortItem.getKey();
		this._oTableOperations.addSorter(new sap.ui.model.Sorter(sSortPath, mParams.sortDescending));
		this._oTableOperations.applyTableOperations();
	},

	// --- Personalization
	onPersonalizationPressed: function() {
		this._oTablePersoController.openDialog();
	},

	// The personalization service for the product list is created here. It is used to store the following user
	// settings: Visible columns, order of columns
	// The stored settings are applied automatically the next time the app starts.
	_initPersonalization: function() {
	    if (sap.ushell.Container) {
		    var oPersonalizationService = sap.ushell.Container.getService("Personalization");
    		var oPersonalizer = oPersonalizationService.getPersonalizer({
	    		container: "nw.epm.refapps.ext.shop", // This key must be globally unique (use a key to
		    	// identify the app) Note that only 40 characters are allowed
			    item: "shopProductTable" // Maximum of 40 characters applies to this key as well
    		});
	    	this._oTablePersoController = new sap.m.TablePersoController({
		    	table: this._oCatalog,
			    componentName: "table",
    			persoService: oPersonalizer
	    	}).activate();
	    } else {
			this.byId("personlizationBtn").setEnabled(false);
		}
	},

	// --- Navigation
	// this handler function is called when a line of the product list is clicked. A navigation to the ProductDetail
	// view is started
	onLineItemPressed: function(oEvent) {
		this._oRouter.navTo("ProductDetails", {
			productId: encodeURIComponent(oEvent.getSource().getBindingContext().getProperty("Id"))
		}, false);
	},

	onNavBack: function() {
		window.history.go(-1);
	},

	// this handler opens the Jam/Share dialog with an Action Sheet containing the standard "AddBookmark" button
	onSharePressed: function(oEvent) {
		var oShareButton = oEvent.getSource();
		var oBtnAddBookmark = null;

		if (!this._oShareDialog) {
			this._oShareDialog = this._createDialog("nw.epm.refapps.ext.shop.view.fragment.ShareSheet");
			oBtnAddBookmark = sap.ui.getCore().byId("btnAddBookmark", this._oShareDialog.getId());
			oBtnAddBookmark.setAppData({
				url: document.URL,
				title: this._oResourceBundle.getText("xtit.products")
			});
		}
		this._oShareDialog.openBy(oShareButton);
	}

});