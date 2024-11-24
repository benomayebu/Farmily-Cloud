// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./openzeppelin/utils/ReentrancyGuard.sol";
import "./openzeppelin/utils/Counters.sol";

/**
 * @title ProductManagement
 * @dev Manages the lifecycle of agricultural products in a supply chain.
 * This contract allows for product registration, status updates, ownership transfers,
 * and maintains a record of all products and pending transfers.
 */
contract ProductManagement is ReentrancyGuard {
    using Counters for Counters.Counter;

    /**
     * @dev Enum representing the possible statuses of a product in the supply chain.
     */
    enum Status {
        Registered,
        Planted,
        Growing,
        Harvested,
        Processed,
        Packaged,
        InTransit,
        Delivered
    }

    /**
     * @dev Struct representing a product in the supply chain.
     */
    struct Product {
        string batchNumber; // Unique identifier for the batch
        string productType; // Type of product (e.g., "Corn", "Wheat")
        string origin; // Place of origin
        uint256 productionDate; // Date of production (Unix timestamp)
        uint256 quantity; // Quantity of the product
        address currentOwner; // Current owner of the product
        Status status; // Current status of the product
        uint256 price; // Price per unit of the product (in wei)
    }

    /**
     * @dev Struct representing a pending transfer of ownership.
     */
    struct PendingTransfer {
        address from; // Address initiating the transfer
        address to; // Address receiving the transfer
        uint256 quantity; // Quantity being transferred
    }

    // Mapping from product ID (bytes32) to Product struct
    mapping(bytes32 => Product) public products;

    // Mapping to keep track of pending transfers (product ID to PendingTransfer struct)
    mapping(bytes32 => PendingTransfer) public pendingTransfers;

    // New mapping from unique identifier to Ethereum address
    mapping(string => address) public identifierToAddress;

    // New mapping from Ethereum address to unique identifier
    mapping(address => string) public addressToIdentifier;

    // Counter for generating unique product IDs
    Counters.Counter private _productIdCounter;

    // Events
    event ProductCreated(
        bytes32 indexed productId,
        string batchNumber,
        address indexed owner
    );
    event StatusUpdated(
        bytes32 indexed productId,
        Status oldStatus,
        Status newStatus
    );
    event OwnershipTransferred(
        bytes32 indexed productId,
        address indexed previousOwner,
        address indexed newOwner,
        uint256 quantity
    );
    event PaymentTriggered(
        bytes32 indexed productId,
        address indexed payer,
        address indexed receiver,
        uint256 amount
    );
    event TransferInitiated(
        bytes32 indexed productId,
        address indexed from,
        address indexed to,
        uint256 quantity
    );
    event TransferAccepted(
        bytes32 indexed productId,
        address indexed from,
        address indexed to,
        uint256 quantity
    );
    event TransferCancelled(bytes32 indexed productId);
    event ProductInfoUpdated(bytes32 indexed productId, string details);

    /**
     * @dev Creates a new product in the system.
     * @param _batchNumber Unique identifier for the batch
     * @param _productType Type of the product
     * @param _origin Origin of the product
     * @param _productionDate Date of production (Unix timestamp)
     * @param _quantity Quantity of the product
     * @param _price Price per unit of the product (in wei)
     */
    function createProduct(
        string memory _batchNumber,
        string memory _productType,
        string memory _origin,
        uint256 _productionDate,
        uint256 _quantity,
        uint256 _price
    ) public {
        require(bytes(_batchNumber).length > 0, "Batch number cannot be empty");
        require(bytes(_productType).length > 0, "Product type cannot be empty");
        require(bytes(_origin).length > 0, "Origin cannot be empty");
        require(
            _productionDate > 0 && _productionDate <= block.timestamp,
            "Invalid production date"
        );
        require(_quantity > 0, "Quantity must be greater than zero");
        require(_price > 0, "Price must be greater than zero");

        _productIdCounter.increment();
        bytes32 productId = bytes32(_productIdCounter.current());

        products[productId] = Product(
            _batchNumber,
            _productType,
            _origin,
            _productionDate,
            _quantity,
            msg.sender,
            Status.Registered,
            _price
        );

        emit ProductCreated(productId, _batchNumber, msg.sender);
    }

    // New event for user registration
    event UserRegistered(string identifier, address userAddress);

    /**
     * @dev Registers a new user with their unique identifier
     * @param _identifier Unique identifier for the user
     */
    function registerUser(string memory _identifier) public {
        require(
            identifierToAddress[_identifier] == address(0),
            "Identifier already registered"
        );
        require(
            bytes(addressToIdentifier[msg.sender]).length == 0,
            "Address already registered"
        );

        identifierToAddress[_identifier] = msg.sender;
        addressToIdentifier[msg.sender] = _identifier;

        emit UserRegistered(_identifier, msg.sender);
    }

    /**
     * @dev Updates the status of a product.
     * @param _productId ID of the product
     * @param _newStatus New status to be set
     */
    function updateProductStatus(bytes32 _productId, Status _newStatus) public {
        require(
            products[_productId].currentOwner != address(0),
            "Product does not exist"
        );
        require(
            products[_productId].currentOwner == msg.sender,
            "Only the current owner can update the status"
        );

        Product storage product = products[_productId];
        Status oldStatus = product.status;
        product.status = _newStatus;

        emit StatusUpdated(_productId, oldStatus, _newStatus);
    }

     // New event for logging errors
    event TransferError(bytes32 indexed productId, string reason);

   /**
     * @dev Initiates a transfer of ownership for a product using unique identifiers.
     * @param _productId ID of the product
     * @param _toIdentifier Unique identifier of the recipient
     * @param _quantity Quantity to be transferred
     */
    function initiateTransfer(
        bytes32 _productId,
        string memory _toIdentifier,
        uint256 _quantity
    ) public nonReentrant {
        // Check if the product exists
        if (!productExists(_productId)) {
            emit TransferError(_productId, "Product does not exist");
            return;
        }

        // Check if the sender is the current owner
        if (products[_productId].currentOwner != msg.sender) {
            emit TransferError(_productId, "Only the current owner can initiate transfer");
            return;
        }

        // Check if the quantity is valid
        if (_quantity == 0 || _quantity > products[_productId].quantity) {
            emit TransferError(_productId, "Invalid transfer quantity");
            return;
        }

        // Check if the recipient is registered
        address toAddress = identifierToAddress[_toIdentifier];
        if (toAddress == address(0)) {
            emit TransferError(_productId, "Recipient not registered");
            return;
        }

        // Check if the sender is trying to transfer to themselves
        if (toAddress == msg.sender) {
            emit TransferError(_productId, "Cannot transfer to yourself");
            return;
        }

        // Check if there's already a pending transfer for this product
        if (pendingTransfers[_productId].quantity != 0) {
            emit TransferError(_productId, "A transfer is already pending for this product");
            return;
        }

        // If all checks pass, create the pending transfer
        pendingTransfers[_productId] = PendingTransfer({
            from: msg.sender,
            to: toAddress,
            quantity: _quantity
        });

        emit TransferInitiated(_productId, msg.sender, toAddress, _quantity);
    }

    /**
     * @dev Checks if a product exists
     * @param _productId ID of the product to check
     * @return bool indicating if the product exists
     */
    function productExists(bytes32 _productId) public view returns (bool) {
        return products[_productId].currentOwner != address(0);
    }

/**
 * @dev Gets the current state of a product
 * @param _productId ID of the product
 * @return batchNumber The batch number of the product
 * @return productType The type of the product
 * @return origin The origin of the product
 * @return productionDate The production date of the product
 * @return quantity The quantity of the product
 * @return currentOwner The current owner of the product
 * @return status The current status of the product
 * @return price The price of the product
 * @return hasPendingTransfer Whether the product has a pending transfer
 */
function getProductState(bytes32 _productId) public view returns (
    string memory batchNumber,
    string memory productType,
    string memory origin,
    uint256 productionDate,
    uint256 quantity,
    address currentOwner,
    Status status,
    uint256 price,
    bool hasPendingTransfer
) {
    require(productExists(_productId), "Product does not exist");
    Product storage product = products[_productId];
    batchNumber = product.batchNumber;
    productType = product.productType;
    origin = product.origin;
    productionDate = product.productionDate;
    quantity = product.quantity;
    currentOwner = product.currentOwner;
    status = product.status;
    price = product.price;
    hasPendingTransfer = pendingTransfers[_productId].quantity != 0;
}
    /**
     * @dev Accepts a pending transfer of ownership.
     * @param _productId ID of the product
     */
    /**
 * @dev Accepts a pending transfer of ownership.
 * @param _transferId The unique identifier of the pending transfer
 */
function acceptTransfer(bytes32 _transferId) public nonReentrant {
    // Retrieve the pending transfer
    PendingTransfer storage transfer = pendingTransfers[_transferId];
    
    // Check if the transfer exists and has a non-zero quantity
    require(transfer.quantity > 0, "No pending transfer for this transfer ID");
    
    // Ensure only the intended recipient can accept the transfer
    require(transfer.to == msg.sender, "Only the intended recipient can accept the transfer");
    
    // Retrieve the product associated with this transfer
    Product storage product = products[_transferId];
    
    // Ensure the product exists
    require(product.currentOwner != address(0), "Product does not exist");
    
    // Verify the transfer initiator is still the current owner
    require(product.currentOwner == transfer.from, "Transfer initiator is no longer the owner");
    
    // Check if the transfer quantity is valid
    require(transfer.quantity <= product.quantity, "Transfer quantity exceeds available product quantity");

    // If the entire product quantity is being transferred
    if (transfer.quantity == product.quantity) {
        // Update the product's current owner
        product.currentOwner = msg.sender;
    } else {
        // Create a new product entry for the partial transfer
        bytes32 newProductId = keccak256(abi.encodePacked(_transferId, block.timestamp, msg.sender));
        products[newProductId] = Product({
            batchNumber: product.batchNumber,
            productType: product.productType,
            origin: product.origin,
            productionDate: product.productionDate,
            quantity: transfer.quantity,
            currentOwner: msg.sender,
            status: product.status,
            price: product.price
        });
        
        // Reduce the quantity of the original product
        product.quantity -= transfer.quantity;
        
        // Emit event for new product creation
        emit ProductCreated(newProductId, product.batchNumber, msg.sender);
    }

    // Emit event for successful transfer
    emit TransferAccepted(_transferId, transfer.from, msg.sender, transfer.quantity);
    
    // Emit event for ownership transfer
    emit OwnershipTransferred(_transferId, transfer.from, msg.sender, transfer.quantity);

    // Clear the pending transfer
    delete pendingTransfers[_transferId];
}

    /**
     * @dev Gets the Ethereum address associated with a unique identifier
     * @param _identifier The unique identifier
     * @return The associated Ethereum address
     */
    function getAddressFromIdentifier(
        string memory _identifier
    ) public view returns (address) {
        return identifierToAddress[_identifier];
    }

    /**
     * @dev Gets the unique identifier associated with an Ethereum address
     * @param _address The Ethereum address
     * @return The associated unique identifier
     */
    function getIdentifierFromAddress(
        address _address
    ) public view returns (string memory) {
        return addressToIdentifier[_address];
    }

    /**
     * @dev Cancels a pending transfer of ownership.
     * @param _productId ID of the product
     */
    function cancelTransfer(bytes32 _productId) public {
        PendingTransfer memory transfer = pendingTransfers[_productId];
        string memory senderIdentifier = addressToIdentifier[msg.sender];
        string memory initiatorIdentifier = addressToIdentifier[transfer.from];

        require(
            keccak256(abi.encodePacked(senderIdentifier)) ==
                keccak256(abi.encodePacked(initiatorIdentifier)),
            "Only the transfer initiator can cancel the transfer"
        );
        require(transfer.quantity > 0, "No pending transfer for this product");

        delete pendingTransfers[_productId];
        emit TransferCancelled(_productId);
    }

    /**
     * @dev Updates the current owner's address for a product if it has changed.
     * @param _productId ID of the product
     */
    function updateProductOwnerAddress(bytes32 _productId) public {
        require(
            products[_productId].currentOwner != address(0),
            "Product does not exist"
        );
        string memory ownerIdentifier = addressToIdentifier[
            products[_productId].currentOwner
        ];
        require(
            keccak256(abi.encodePacked(addressToIdentifier[msg.sender])) ==
                keccak256(abi.encodePacked(ownerIdentifier)),
            "Only the current owner can update the address"
        );

        products[_productId].currentOwner = msg.sender;
    }

    /**
     * @dev Updates additional information for a product.
     * @param _productId ID of the product
     * @param _details JSON string containing updated product details
     */
    function updateProductInfo(
        bytes32 _productId,
        string memory _details
    ) public {
        require(
            products[_productId].currentOwner == msg.sender,
            "Only the current owner can update product info"
        );
        emit ProductInfoUpdated(_productId, _details);
    }

    /**
     * @dev Retrieves product details.
     * @param _productId ID of the product
     * @return Product details (batchNumber, productType, origin, productionDate, quantity, currentOwner, status, price)
     */
    function getProduct(
        bytes32 _productId
    )
        public
        view
        returns (
            string memory,
            string memory,
            string memory,
            uint256,
            uint256,
            address,
            Status,
            uint256
        )
    {
        require(
            products[_productId].currentOwner != address(0),
            "Product does not exist"
        );
        Product memory product = products[_productId];
        return (
            product.batchNumber,
            product.productType,
            product.origin,
            product.productionDate,
            product.quantity,
            product.currentOwner,
            product.status,
            product.price
        );
    }

    /**
     * @dev Retrieves a product by its blockchain ID.
     * @param _blockchainId The blockchain ID of the product
     * @return Product details (batchNumber, productType, origin, productionDate, quantity, currentOwner, status, price)
     */
    function getProductByBlockchainId(
        bytes32 _blockchainId
    )
        public
        view
        returns (
            string memory,
            string memory,
            string memory,
            uint256,
            uint256,
            address,
            Status,
            uint256
        )
    {
        require(
            products[_blockchainId].currentOwner != address(0),
            "Product does not exist"
        );
        Product memory product = products[_blockchainId];
        return (
            product.batchNumber,
            product.productType,
            product.origin,
            product.productionDate,
            product.quantity,
            product.currentOwner,
            product.status,
            product.price
        );
    }

    /**
     * @dev Triggers payment for a delivered product.
     * @param _productId ID of the product
     */
    function triggerPayment(bytes32 _productId) public payable nonReentrant {
        require(
            products[_productId].currentOwner != address(0),
            "Product does not exist"
        );
        Product storage product = products[_productId];
        require(
            product.status == Status.Delivered,
            "Product must be delivered to trigger payment"
        );
        require(
            msg.value == product.price * product.quantity,
            "Incorrect payment amount"
        );

        address payable owner = payable(product.currentOwner);
        owner.transfer(msg.value);
        emit PaymentTriggered(_productId, msg.sender, owner, msg.value);
    }

    /**
     * @dev Gets the total number of products in the system.
     * @return The total number of products
     */
    function getProductCount() public view returns (uint256) {
        return _productIdCounter.current();
    }

    /**
     * @dev Gets a product ID by its index.
     * @param _index The index of the product ID
     * @return The product ID at the given index
     */
    function getProductIdByIndex(uint256 _index) public view returns (bytes32) {
        require(
            _index > 0 && _index <= _productIdCounter.current(),
            "Index out of bounds"
        );
        return bytes32(_index);
    }
}