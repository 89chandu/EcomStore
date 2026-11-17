// Keep all persistent data under store-specific keys.
const storageKeys = {
    products: "ecomStore.products",
    cart: "ecomStore.cart",
    filters: "ecomStore.filters",
    checkout: "ecomStore.checkout",
    lastOrder: "ecomStore.lastOrder"
}

function readStorage(key, fallback, isValid) {
    try {
        const savedValue = localStorage.getItem(key)
        if (savedValue === null) return fallback

        const value = JSON.parse(savedValue)
        return isValid(value) ? value : fallback
    } catch (error) {
        console.warn(`Could not read ${key} from localStorage.`, error)
        return fallback
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value))
        return true
    } catch (error) {
        console.warn(`Could not save ${key} to localStorage.`, error)
        return false
    }
}

function isValidProduct(product) {
    return product !== null && typeof product === "object" &&
        Number.isSafeInteger(product.id) && product.id > 0 &&
        typeof product.name === "string" &&
        typeof product.category === "string" &&
        typeof product.image === "string" &&
        Number.isFinite(product.price) && product.price >= 0 &&
        Number.isFinite(product.rating) && product.rating >= 0 && product.rating <= 5
}

// Both pages restore cart items from the same saved product catalog.
function readCart(products) {
    const savedCart = readStorage(storageKeys.cart, [], Array.isArray)
    const restoredCart = []

    savedCart.forEach(item => {
        if (!item || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) return
        const product = products.find(product => String(product.id) === String(item.id))
        if (!product || restoredCart.some(cartItem => cartItem.id === product.id)) return
        restoredCart.push({ ...product, quantity: item.quantity })
    })

    return restoredCart
}
