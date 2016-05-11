jQuery.sap.require("sap.ca.ui.model.type.Date");
jQuery.sap.require("sap.ui.core.mvc.Controller");
jQuery.sap.require("sap.ca.ui.model.format.AmountFormat");
jQuery.sap.require("nw.epm.refapps.ext.shop.util.formatter");
jQuery.sap.require("nw.epm.refapps.ext.shop.control.RatingAndCount");

sap.ui.core.mvc.Controller.extend("nw.epm.refapps.ext.shop.view.S3_ProductDetails", {
	_bIsEditReview: false,
	_bIsReviewDialogOpen: false,
	_bIsReviewRatingFragmentOpened: false,
	_oEventBus: null,
	_oSortDialog: null,
	_oReviewDialog: null,
	_oResourceBundle: null,
	_oLargeImage: null,
	_oPopover: null,
	_oItemTemplate: null,
	_oReviewTable: null,
	_sProductPath: "",
	_sProductId: "",
	_sReviewPath: "",
	_sIdentity: "nw.epm.refapps.ext.shop",

	onInit: function() {
		// Use 'local' event bus of component for communication between views
		this._oView = this.getView();
		this._oComponent = sap.ui.component(sap.ui.core.Component.getOwnerIdFor(this._oView));
		this._oEventBus = this._oComponent.getEventBus();
		this._oResourceBundle = this._oComponent.getModel("i18n").getResourceBundle();
		this._oRouter = this._oComponent.getRouter();
		this._oReviewTable = this.byId("reviewTable");
		this._oItemTemplate = this.byId("reviewListItem").clone();

		// Get Context Path for S3 Screen
		this._oRouter.attachRoutePatternMatched(this._onRoutePatternMatched, this);

		// element binding for the counter on the shopping cart button
		this._oView.bindElement({
			path: "/ShoppingCarts(-1)",
			parameters: {
				select: "FormattedCustomerName,FormattedAddress,Total,CurrencyCode,TotalQuantity"
			}
		});
	},

	// Bind Review Table using oData Reviews Entity
	_bindReviewTable: function(sURL) {
		this._oReviewTable.bindItems({
			path: sURL,
			batchGroupId: "reviews",
			template: this._oItemTemplate,
			sorter: new sap.ui.model.Sorter("ChangedAt", true)
		});
	},

	_addFavoriteButtonText: function() {
		var sFavorite;
		if (this.byId("productDetailsPage").getBindingContext().getProperty("IsFavoriteOfCurrentUser")) {
			sFavorite = this._oResourceBundle.getText("xbut.removeFavorite");
			sap.ui.getCore().byId("btnFavorite", "overflowSheet").setText(sFavorite);
		} else {
			sFavorite = this._oResourceBundle.getText("xbut.addFavorite");
			sap.ui.getCore().byId("btnFavorite", "overflowSheet").setText(sFavorite);
		}
	},

	_onRoutePatternMatched: function(oEvent) {
		if (oEvent.getParameter("name") !== "ProductDetails") {
			return;
		}
		// Build binding context path from URL parameters: the URL contains the product ID in parameter 'productId'.
		// The path pattern is: /Products('<productId>')
		this._sProductId = decodeURIComponent(oEvent.getParameter("arguments").productId);
		this._sProductPath = "/Products('" + this._sProductId + "')";
		this._sReviewPath = this._sProductPath + "/Reviews";

		this._bIsEditReview = false;

		var sSelectParameters = "Name,Price,CurrencyCode,ImageUrl,IsFavoriteOfCurrentUser,StockQuantity,";
		sSelectParameters += "MainCategoryName,SubCategoryName,Id,Description,SupplierName,AverageRating,";
		sSelectParameters += "RatingCount,QuantityUnit,DimensionDepth,DimensionUnit,DimensionWidth,";
		sSelectParameters += "DimensionHeight,WeightMeasure,WeightUnit,HasReviewOfCurrentUser,LastModified";

		// Bind Object Header and Form using oData
		this.byId("productDetailsPage").bindElement({
			path: this._sProductPath,
			batchGroupId: "reviews",
			parameters: {
				select: sSelectParameters
			}
		});

		//Navigation to Empty Page if the the product does not exist
		this.byId("productDetailsPage").getElementBinding().attachEventOnce(
			"dataReceived",
			jQuery.proxy(function() {
				if (this.byId("productDetailsPage").getBindingContext().getPath() !== this._sProductPath) {
					this._oRouter.navTo("EmptyPage", {}, false);
				}
			}, this));

		this._bIsReviewRatingFragmentOpened = false;

		// Bind Review Table using oData Reviews Entity
		this._bindReviewTable(this._sReviewPath);
		this._toggleReviewButtonText();
	},

	// --- Actions in Header Bar
	onShoppingCartPressed: function() {
		this._oRouter.navTo("ShoppingCart", {}, false);
	},

	// --- Actions in Object Header
	// Enlarge the image in a separate dialog box
	onImagePressed: function() {
		if (!this._oLargeImage) {
			// associate controller with the fragment
			this._oLargeImage = this._createDialog("nw.epm.refapps.ext.shop.view.fragment.ProductImage");
		}
		this._oLargeImage.bindElement(this.byId("productDetailsPage").getBindingContext().getPath());
		this._oLargeImage.open();
	},

	// Close the dialog box for the enlarged image
	onImageOKPressed: function() {
		this._oLargeImage.close();
	},

	// --- Actions in Form
	// Connect Supplier Card Quick View
	onSupplierPressed: function(oEvent) {
		// Read supplier data
		var oModel = this._oComponent.getModel();
		var sSupplierPath = this._sProductPath + "/Supplier";
		var oSupplierData = oModel.getObject(sSupplierPath);
		if (oSupplierData) {
			this._openSupplierCard(oSupplierData, oEvent.getSource());
			return;
		}

		var onSuccess = function(oSourceControl, oData) {
			oSupplierData = oData;
			jQuery.extend(oModel.getObject(this._sProductPath), {
				"Supplier": oSupplierData
			});
			this._openSupplierCard(oSupplierData, oSourceControl);
		};
		var onError = function(oError) {
			jQuery.sap.require("nw.epm.refapps.ext.shop.util.messages");
			nw.epm.refapps.ext.shop.util.messages.showErrorMessage(oError);
		};

		oModel.read(sSupplierPath, {
			success: jQuery.proxy(onSuccess, this, oEvent.getSource()),
			error: jQuery.proxy(onError, this)
		});
	},

	_openSupplierCard: function(oSupplierData, oSourceControl) {
		var sProductName = this._oComponent.getModel().getObject(this._sProductPath).Name;
		var oSupplierConfig = {
			title: this._oResourceBundle.getText("xtit.supplier"),
			companyname: oSupplierData.Name,
			companyphone: oSupplierData.Phone,
			companyaddress: oSupplierData.FormattedAddress,
			maincontactname: oSupplierData.FormattedContactName,
			maincontactphone: oSupplierData.ContactPhone1,
			maincontactmobile: oSupplierData.ContactPhone2,
			maincontactemail: oSupplierData.ContactEmail,
			maincontactemailsubj: this._oResourceBundle.getText("xtit.emailSubject", [sProductName])
		};
		jQuery.sap.require("sap.ca.ui.quickoverview.CompanyLaunch");
		new sap.ca.ui.quickoverview.CompanyLaunch(oSupplierConfig).openBy(oSourceControl);
	},

	// create Review Rating dialog box
	onRatingPressed: function(oEvent) {
		if (!this._oPopover) {
			this._oPopover = sap.ui.xmlfragment("reviewRatingFragment",
				"nw.epm.refapps.ext.shop.view.fragment.ReviewRating", this);
		}
		// Bind Rating dialog box with oData Entity ReviewAggregates
		if (!this._bIsReviewRatingFragmentOpened) {
			// switch the dialog to compact mode if the hosting view has compact mode
			jQuery.sap.syncStyleClass("sapUiSizeCompact", this._oView, this._oPopover);
			this._oView.addDependent(this._oPopover);

			var oList = sap.ui.core.Fragment.byId("reviewRatingFragment", "reviewRatingList");
			oList.bindAggregation("content", {
				path: this._sProductPath + "/ReviewAggregates",
				template: oList.getContent()[0].clone()
			});
		}
		// Delay because addDependent will perform asynchronous rendering again and the actionSheet will immediately
		// close without it.
		var oOpeningControl = oEvent.getParameter("source");
		jQuery.sap.delayedCall(0, this, function() {
			this._oPopover.openBy(oOpeningControl);
		});
		this._oPopover.addStyleClass("sapUiPopupWithPadding");
		if (sap.ui.Device.system.phone) {
			// Open the dialog box depending on the space above or below the rating control
			var oRatingCount = this.getView().byId("ratingCount"),
				position = oRatingCount.$().offset();

			if (window.innerHeight - position.top < position.top) {
				this._oPopover.setPlacement("Top");
			} else {
				this._oPopover.setPlacement("Bottom");
			}
		}
		this._bIsReviewRatingFragmentOpened = true;
	},

	// --- Actions on Table entries
	// View Settings Dialog / Sort Rating
	onTableSettingsPressed: function() {
		if (!this._oSortDialog) {
			this._oSortDialog = this._createDialog("nw.epm.refapps.ext.shop.view.fragment.SettingsDialog");
		}
		this._oSortDialog.open();
	},

	onSortConfirmed: function(oEvent) {
		// apply sorter to binding
		var aSorters = [];
		var mParams = oEvent.getParameters();
		aSorters.push(new sap.ui.model.Sorter(mParams.sortItem.getKey(), mParams.sortDescending));
		this._oReviewTable.getBinding("items").sort(aSorters);
	},

	// --- Actions on buttons in footer bar
	// When an item is added to the ShoppingCart, this method triggers the service call to the back end.
	// Using a function import, the back end then creates a ShoppingCart if none exists yet, or
	// adds a new ShoppingCartItem to an existing cart, or updates an existing item if the added
	// product is already in the ShoppingCart
	onAddToCartPressed: function(oEvent) {
		oEvent.getSource().getModel().callFunction("/AddProductToShoppingCart", {
			method: "POST",
			urlParameters: {
				ProductId: oEvent.getSource().getBindingContext().getProperty("Id")
			},
			success: jQuery.proxy(this.onCartSrvSuccess, this),
			error: jQuery.proxy(this.onSrvError, this)
		});
	},

	// When the button is pressed, the opposite value (to that retrieved last time) is passed to the back end. MERGE is
	// used to send only the changed value to the back end and not all product data
	onToggleFavoritePressed: function() {
		var oBindingContext = this.byId("productDetailsPage").getBindingContext();
		this.byId("pd_header").setMarkFavorite(!(oBindingContext.getProperty("IsFavoriteOfCurrentUser")));
	},

	_initializeReviewDialog: function() {
		this._oReviewDialog = sap.ui.xmlfragment("nw.epm.refapps.ext.shop.view.fragment.ReviewDialog", this);
		// switch the dialog to compact mode if the hosting view has compact mode
		jQuery.sap.syncStyleClass("sapUiSizeCompact", this._oView, this._oReviewDialog);
		// Set the focus on the text area
		this._oReviewDialog.setInitialFocus("textArea");
		this._oView.addDependent(this._oReviewDialog);
	},

	// Button to open the review dialog. If the logged-on user does not have his or her own review, the dialog is opened
	// with initial values, otherwise the URL of the user's own review is determined in the list of reviews and bound to
	// the elements of the dialog to open the dialog with the values of the review. In addition, the visibility of the
	// recycle bin is triggered depending on whether or not the logged-on user has his or her own review.
	onEditReviewPressed: function(oEvent) {
		if (!this._oReviewDialog) {
			this._initializeReviewDialog();
		}
		this._oReviewDialog.unbindObject();

		var oModel = oEvent.getSource().getModel();
		oModel.setRefreshAfterChange(false);

		sap.ui.getCore().byId("btnOK", "reviewDialog").setEnabled(false);

		this._bIsReviewDialogOpen = true;
		var bHasOwnReview = false,
			oBTNDelete = sap.ui.getCore().byId("reviewDelete", "reviewDialog");
		oBTNDelete.setVisible(bHasOwnReview);

		// Determine the review URL and bind values to the elements
		var i = 0;
		for (i = 0; i < this._oReviewTable.getItems().length; i++) {
			if (this._oReviewTable.getItems()[i].getBindingContext().getProperty("IsReviewOfCurrentUser")) {
				this._bIsEditReview = true;
				this._oReviewDialog.setBindingContext(this._oReviewTable.getItems()[i].getBindingContext());
				bHasOwnReview = true;
				oBTNDelete.setVisible(bHasOwnReview);
				break;
			}
		}
		// Open dialog empty if the logged-on user does not have his or her own review
		if (!bHasOwnReview) {
			//  this._oReviewDialog.setBindingContext("null");
			var oNewReview = oModel.createEntry("/Reviews", {
				batchGroupId: "reviews"
			});
			oModel.setProperty("ProductId", this._sProductId, oNewReview);
			this._oReviewDialog.setBindingContext(oNewReview);
		}
		this._oReviewDialog.open();
	},

	// Toggle button text for the user's own reviews to allow creation of only one review per user. If there is no
	// review by the logged-on user, the button text is "Write a Review"; if a review exists, the text is "My Review".
	// The button text can only be changed once the entire data has been retrieved from the back end. Therefore a change
	// handler is called which listens always to the change of the data binding independent if data are received or not.
	// In case of an error while data retrieval the binding context is initial
	_toggleReviewButtonText: function() {
		var fnChangeHandler = jQuery.proxy(function() {
			if (this.byId("productDetailsPage").getBindingContext()) {
				if (this.byId("productDetailsPage").getBindingContext().getProperty("HasReviewOfCurrentUser")) {
					var sMyReview = this._oResourceBundle.getText("xbut.myReview");
					this.byId("btnReview").setText(sMyReview);
				} else {
					var sWriteReview = this._oResourceBundle.getText("xbut.writeReview");
					this.byId("btnReview").setText(sWriteReview);
				}
			}
		}, this);
		this.getView().getModel().attachRequestCompleted(fnChangeHandler);
	},

	// --- Actions on links for a review item
	// Link "Rate as Helpful" is pressed
	onRateAsHelpfulPressed: function(oEvent) {
		var sPath = oEvent.getSource().getBindingContext().getPath() + "/HelpfulForCurrentUser",
			oModel = this
			.getView().getModel();

		oModel.setProperty(sPath, true);
		oModel.submitChanges({
			error: jQuery.proxy(this.onSrvError, this)
		});
	},

	// Open Review dialog box if "Edit" link is pressed and fill with Review data
	onEditReviewLinkPressed: function(oEvent) {
		if (!this._oReviewDialog) {
			this._initializeReviewDialog();
		}
		sap.ui.getCore().byId("btnOK", "reviewDialog").setEnabled(false); // disable OK button on review dialog
		sap.ui.getCore().byId("reviewDelete", "reviewDialog").setVisible(true); // show delete button on review dialog
		this._oReviewDialog.bindElement(oEvent.getSource().getBindingContext().getPath());
		this._bIsEditReview = true;
		this._bIsReviewDialogOpen = true;
		this._oReviewDialog.open();
	},

	// Delete Review if "Delete" link is pressed
	onDeleteReviewLinkPressed: function(oEvent) {
		oEvent.getSource().getModel().remove(oEvent.getSource().getBindingContext().getPath(), {
			success: jQuery.proxy(this.onReviewDeleteSrvSuccess, this),
			error: jQuery.proxy(this.onSrvError, this)
		});
		this._bIsEditReview = false;

		this.byId("btnReview").setText(this._oResourceBundle.getText("xbut.writeReview"));
	},

	// --- Actions on buttons on the review dialog
	onReviewDialogOKPressed: function(oEvent) {
		oEvent.getSource().getModel().setRefreshAfterChange(true);
		this._oReviewDialog.close();

		oEvent.getSource().getModel().submitChanges({
			success: jQuery.proxy(this.onReviewSrvSuccess, this),
			error: jQuery.proxy(this.onSrvError, this),
			batchGroupId: "reviews"
		});
		this.byId("btnReview").setText(this._oResourceBundle.getText("xbut.myReview"));
	},

	// Close the Review Dialog
	onReviewDialogCancelPressed: function() {
		this.getView().getModel().resetChanges();
		this.getView().getModel().setRefreshAfterChange(true);
		this._oReviewDialog.unbindObject();
		this._oReviewDialog.close();
	},

	onReviewDialogDeletePressed: function(oEvent) {
		var sDeleteReviewPath = oEvent.getSource().getBindingContext().getPath();
		if (this._bIsReviewDialogOpen) {
			this._oReviewDialog.close();
			this._bIsReviewDialogOpen = false;
		}
		this._oReviewDialog.unbindContext();
		oEvent.getSource().getModel().remove(sDeleteReviewPath, {
			success: jQuery.proxy(this.onReviewDeleteSrvSuccess, this),
			error: jQuery.proxy(this.onSrvError, this)
		});
		this._bIsEditReview = false;
		this.byId("btnReview").setText(this._oResourceBundle.getText("xbut.writeReview"));
	},

	// Enable OK button if Rating and Comment is filled
	onTextAreaChanged: function() {
		sap.ui.getCore().byId("btnOK", "reviewDialog").setEnabled(false);
		var iRatingCount = sap.ui.getCore().byId("ratingIndicator", "reviewDialog").getValue();
		var sReviewComment = sap.ui.getCore().byId("textArea", "reviewDialog").getValue();
		if (iRatingCount > 0 && sReviewComment) {
			sap.ui.getCore().byId("btnOK", "reviewDialog").setEnabled(true);
		}
	},

	// Enable OK button if Rating and Comment is filled
	onRatingChanged: function() {
		sap.ui.getCore().byId("btnOK", "reviewDialog").setEnabled(false);
		var iRatingCount = sap.ui.getCore().byId("ratingIndicator", "reviewDialog").getValue();
		var sReviewComment = sap.ui.getCore().byId("textArea", "reviewDialog").getValue();
		if (iRatingCount > 0 && sReviewComment) {
			sap.ui.getCore().byId("btnOK", "reviewDialog").setEnabled(true);
		}
	},

	// --- oData Service callback functions
	onCartSrvSuccess: function(oEvent) {
		jQuery.sap.require("sap.m.MessageToast");
		var sKey = this._oComponent.getModel().createKey("/Products", {
			Id: oEvent.ProductId
		});
		var sProductName = this._oComponent.getModel().getProperty(sKey).Name;
		sap.m.MessageToast.show(this._oResourceBundle.getText("ymsg.addProduct", [sProductName]));
		this._oEventBus.publish(this._sIdentity, "shoppingCartRefresh");
		this.byId("btnProductHeader").getElementBinding().refresh();
	},

	// Callback if creation or editing of a review was successful
	onReviewSrvSuccess: function() {
		// Initialize the review dialog
		this._oReviewDialog.unbindObject();
		this.getView().getModel().refresh();
	},

	// Callback if deletion of a review was successful
	onReviewDeleteSrvSuccess: function() {
		if (this._oReviewDialog) {
			// Remove the BindingContext, otherwise the Binding will be refreshed with an invalid path
			this._oReviewDialog.unbindObject();
		}
		this.byId("pd_header").bindElement(this._sProductPath);
		this.byId("pd_header").getElementBinding().refresh();
	},

	// Callback in the event of errors
	onSrvError: function(oResponse) {
		jQuery.sap.require("nw.epm.refapps.ext.shop.util.messages");
		nw.epm.refapps.ext.shop.util.messages.showErrorMessage(oResponse);
	},

	onNavBack: function() {
		window.history.go(-1);
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
	},

	// This is the handler method of the list toolbar's overflow button. This button is only visible on
	// phones and starts the action sheet containing the sort and group that are not
	// displayed individually in phone mode.
	onOverflowPressed: function(oEvent) {
		if (!this._oActionSheet) {
			this._oActionSheet = this._createDialog("nw.epm.refapps.ext.shop.view.fragment.ProductDetailOverflow");
		}
		if (this.byId("productDetailsPage").getBindingContext()) {
			if (this.byId("productDetailsPage").getBindingContext().getProperty("HasReviewOfCurrentUser")) {
				var sMyReview = this._oResourceBundle.getText("xbut.myReview");
				sap.ui.getCore().byId("btnReview", "overflowSheet").setText(sMyReview);
			} else {
				var sWriteReview = this._oResourceBundle.getText("xbut.writeReview");
				sap.ui.getCore().byId("btnReview", "overflowSheet").setText(sWriteReview);
			}
		}

		this._oActionSheet.openBy(oEvent.getSource());
		this._addFavoriteButtonText();
	}
});