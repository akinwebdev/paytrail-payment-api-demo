const sdkState = {
  klarna: null,
  initializedClientId: null,
};

const checkoutState = {
  baseAmount: 0,
  productLineItem: null,
  shippingOptions: [],
  selectedShippingOption: null,
};

function getShippingAmount(option) {
  if (!option) {
    return 0;
  }

  const amount = Number(option.amount);
  return Number.isFinite(amount) ? amount : 0;
}

function createBaseLineItems() {
  if (!checkoutState.productLineItem) {
    return [];
  }

  const { name, quantity, totalAmount } = checkoutState.productLineItem;
  return [
    {
      name,
      quantity,
      totalAmount,
    },
  ];
}

function buildLineItemsWithShipping(option) {
  const lineItems = createBaseLineItems();

  if (option) {
    lineItems.push({
      name: option.displayName || option.name || "Shipping",
      quantity: 1,
      totalAmount: getShippingAmount(option),
    });
  }

  return lineItems;
}

function calculateTotalAmount(option) {
  return checkoutState.baseAmount + getShippingAmount(option);
}

function resolveShippingOptions(shippingAddress) {
  const baseOptions = [
    {
      amount: 499,
      description: "Delivery within 3-5 business days.",
      displayName: "Standard shipping",
      shippingOptionReference: "standard-shipping",
    },
    {
      amount: 1299,
      description: "Delivery within 1-2 business days.",
      displayName: "Express shipping",
      shippingOptionReference: "express-shipping",
    },
  ];

  const normalizedOptions = baseOptions.map((option) => ({ ...option }));

  const country =
    shippingAddress && typeof shippingAddress.country === "string"
      ? shippingAddress.country.toUpperCase()
      : null;

  if (country && country !== "DE") {
    return normalizedOptions.map((option) => ({
      ...option,
      amount: option.amount + 300,
      description: `${option.description} (${country})`,
    }));
  }

  return normalizedOptions;
}

function findShippingOption(reference) {
  if (!reference) {
    return null;
  }

  return (
    checkoutState.shippingOptions.find(
      (option) => option.shippingOptionReference === reference
    ) || null
  );
}

async function loadKlarnaSdk() {
  const clientId = sessionStorage.getItem("klarnaClientId");

  if (sdkState.klarna && clientId === sdkState.initializedClientId) {
    return sdkState.klarna;
  }

  if (clientId !== sdkState.initializedClientId) {
    sdkState.klarna = null;
  }

  if (!clientId) {
    alert("Klarna Client ID not set. Please set it on the homepage first.");
    return null;
  }

  try {
    const { KlarnaSDK } = await import(
      "https://js.klarna.com/web-sdk/v2/klarna.mjs"
    );

    sdkState.klarna = await KlarnaSDK({
      clientId: clientId,
      locale: "en-EN",
    });

    sdkState.initializedClientId = clientId;
    window.Klarna = sdkState.klarna;
    initializeKlarnaEvents(sdkState.klarna);
    return sdkState.klarna;
  } catch (error) {
    console.error("Failed to load Klarna SDK:", error);
    alert(
      `Failed to load Klarna SDK. Please check the Client ID and that the domain ${window.location.origin} is whitelisted.`
    );
    return null;
  }
}

function initializeKlarnaEvents(KlarnaInstance) {
  if (!KlarnaInstance) return;

  KlarnaInstance.Payment.on("error", (err) => {
    console.error("Klarna Payment error:", err);
    alert(`An error occurred: ${err.errorCode} - ${err.errorMessage}`);
  });

  KlarnaInstance.Payment.on(
    "shippingaddresschange",
    async (paymentRequest, shippingAddress) => {
      const shippingOptions = resolveShippingOptions(shippingAddress);
      const previousSelectionReference =
        checkoutState.selectedShippingOption?.shippingOptionReference || null;

      checkoutState.shippingOptions = shippingOptions;
      checkoutState.selectedShippingOption = null;

      if (previousSelectionReference) {
        const reusedOption = findShippingOption(previousSelectionReference);
        if (reusedOption) {
          checkoutState.selectedShippingOption = reusedOption;
        }
      }

      return {
        shippingOptions,
      };
    }
  );

  KlarnaInstance.Payment.on(
    "shippingoptionselect",
    async (paymentRequest, shippingOption) => {
      const selectedOption =
        findShippingOption(shippingOption?.shippingOptionReference) ||
        (shippingOption ? { ...shippingOption } : null);

      if (!selectedOption) {
        checkoutState.selectedShippingOption = null;
        return {
          amount: calculateTotalAmount(null),
          lineItems: buildLineItemsWithShipping(null),
        };
      }

      checkoutState.selectedShippingOption = selectedOption;

      return {
        amount: calculateTotalAmount(selectedOption),
        lineItems: buildLineItemsWithShipping(selectedOption),
      };
    }
  );

  KlarnaInstance.Payment.on("complete", (paymentRequest) => {
    const interoperabilityToken =
      paymentRequest.stateContext.interoperabilityToken;
    console.log("KEC interoperability token", interoperabilityToken);

    const interopTokenEl = document.getElementById("interop-token");
    if (interopTokenEl) {
      interopTokenEl.textContent = interoperabilityToken;
    }

    if (interoperabilityToken) {
      try {
        sessionStorage.setItem(
          "interoperabilityToken",
          interoperabilityToken
        );
      } catch (e) {
        console.warn("Unable to store interoperability token", e);
      }
    }

    alert(
      `Payment complete! See the Interoperability Token displayed on this page.`
    );
    return false;
  });
}

async function initKlarnaButton() {
  const KlarnaInstance = await loadKlarnaSdk();
  if (!KlarnaInstance) return;

  const buttonMountEl = document.getElementById("klarna-payment-btn");
  if (!buttonMountEl) {
    return;
  }

  const price = parseInt(buttonMountEl.dataset.price, 10);
  const normalizedPrice = Number.isNaN(price) ? 0 : price;
  const isOnSmartwatchPage = document.getElementById("product-page-2");

  checkoutState.baseAmount = normalizedPrice;
  checkoutState.productLineItem = {
    name: "Omega Aqua Terra",
    quantity: 1,
    totalAmount: normalizedPrice,
  };
  checkoutState.shippingOptions = [];
  checkoutState.selectedShippingOption = null;

  const buttonConfig = {
    initiate: () => ({
      currency: "EUR",
      amount: normalizedPrice,
      shippingConfig: {
        mode: "EDITABLE",
      },
      collectCustomerProfile: ["profile:email", "profile:name", "profile:phone", "profile:billing_address"],
      supplementaryPurchaseData: {
        lineItems: [
          {
            name: checkoutState.productLineItem.name,
            quantity: checkoutState.productLineItem.quantity,
            totalAmount: checkoutState.productLineItem.totalAmount,
          },
        ],
      },
      customerInteractionConfig: {
        returnUrl:
          "https://example.com?id={klarna.paymentRequest.id}&token={klarna.paymentRequest.payment_token}",
      },
    }),
    initiationMode: "ON_PAGE",
  };

  if (isOnSmartwatchPage) {
    buttonConfig.shape = "pill";
    buttonConfig.theme = "outlined";
    (buttonConfig.locale = sessionStorage.getItem("klarnaLocale")),
      (buttonConfig.label = "PAY EDDY OR PAY");
    buttonConfig.intents = ["PAY"];
  }

  KlarnaInstance.Payment.button(buttonConfig).mount(`#klarna-payment-btn`);
}

document.addEventListener("DOMContentLoaded", () => {
  const appOriginEl = document.getElementById("app-origin");
  if (appOriginEl) {
    appOriginEl.textContent = window.location.origin;
  }

  const storedToken = sessionStorage.getItem("interoperabilityToken");
  if (storedToken) {
    const interopTokenEl = document.getElementById("interop-token");
    if (interopTokenEl) {
      interopTokenEl.textContent = storedToken;
    }
  }

  initKlarnaButton();
});
