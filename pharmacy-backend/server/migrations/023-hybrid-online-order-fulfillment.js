async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.some((table) => (
    (typeof table === 'string' ? table : table.tableName || table.name).toLowerCase()
      === tableName.toLowerCase()
  ));
}

async function addColumnIfMissing(queryInterface, tableName, columnName, definition) {
  const columns = await queryInterface.describeTable(tableName);
  if (!columns[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
}

async function addIndexIfMissing(queryInterface, tableName, fields, options) {
  const indexes = await queryInterface.showIndex(tableName);
  if (!indexes.some((index) => index.name === options.name)) {
    await queryInterface.addIndex(tableName, fields, options);
  }
}

module.exports = {
  version: '023',
  description: 'Add online order reservations, preorder tasks and fulfillment metadata',
  async up({ queryInterface, DataTypes }) {
    await addColumnIfMissing(queryInterface, 'Batches', 'reservedQuantity', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await addColumnIfMissing(queryInterface, 'Medicines', 'reservedQuantity', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    const orderColumns = {
      pickupReference: {
        type: DataTypes.STRING(32),
        allowNull: true,
      },
      pickupReadyAt: { type: DataTypes.DATE, allowNull: true },
      handedOverAt: { type: DataTypes.DATE, allowNull: true },
      deliveredAt: { type: DataTypes.DATE, allowNull: true },
      handedOverByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
      },
      deliveryProvider: { type: DataTypes.STRING(32), allowNull: true },
      yangoReference: { type: DataTypes.STRING(120), allowNull: true },
      yangoRiderDetails: { type: DataTypes.TEXT, allowNull: true },
      yangoFee: { type: DataTypes.FLOAT, allowNull: true },
      trackingLink: { type: DataTypes.TEXT, allowNull: true },
      gatewayPaymentReference: { type: DataTypes.STRING(120), allowNull: true },
      paymentConfirmedAt: { type: DataTypes.DATE, allowNull: true },
      refundStatus: { type: DataTypes.STRING(24), allowNull: true },
      refundReference: { type: DataTypes.STRING(120), allowNull: true },
    };
    for (const [columnName, definition] of Object.entries(orderColumns)) {
      await addColumnIfMissing(queryInterface, 'Orders', columnName, definition);
    }
    await addIndexIfMissing(queryInterface, 'Orders', ['pickupReference'], {
      name: 'orders_pickup_reference_unique',
      unique: true,
    });

    if (!(await tableExists(queryInterface, 'OrderItems'))) {
      await queryInterface.createTable('OrderItems', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        orderId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: 'Orders', key: 'id' },
          onDelete: 'CASCADE',
        },
        medicineId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'Medicines', key: 'id' },
          onDelete: 'SET NULL',
        },
        productName: { type: DataTypes.STRING, allowNull: false },
        quantity: { type: DataTypes.INTEGER, allowNull: false },
        reservedQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        preorderQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        outstandingPreorderQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        unitPrice: { type: DataTypes.FLOAT, allowNull: false },
        totalPrice: { type: DataTypes.FLOAT, allowNull: false },
        fulfillmentStatus: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: 'Awaiting Payment',
        },
        estimatedFulfillmentAt: { type: DataTypes.DATE, allowNull: true },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
    }
    await addColumnIfMissing(queryInterface, 'OrderItems', 'outstandingPreorderQuantity', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await addIndexIfMissing(queryInterface, 'OrderItems', ['orderId'], {
      name: 'order_items_order_id_idx',
    });
    await addIndexIfMissing(queryInterface, 'OrderItems', ['medicineId', 'fulfillmentStatus'], {
      name: 'order_items_medicine_fulfillment_idx',
    });

    if (!(await tableExists(queryInterface, 'OrderItemReservations'))) {
      await queryInterface.createTable('OrderItemReservations', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        orderItemId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: 'OrderItems', key: 'id' },
          onDelete: 'CASCADE',
        },
        batchId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'Batches', key: 'id' },
          onDelete: 'RESTRICT',
        },
        quantity: { type: DataTypes.INTEGER, allowNull: false },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
    }
    await addIndexIfMissing(queryInterface, 'OrderItemReservations', ['orderItemId'], {
      name: 'order_item_reservations_item_idx',
    });
    await addIndexIfMissing(queryInterface, 'OrderItemReservations', ['batchId'], {
      name: 'order_item_reservations_batch_idx',
    });

    if (!(await tableExists(queryInterface, 'ReplenishmentTasks'))) {
      await queryInterface.createTable('ReplenishmentTasks', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        orderItemId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          unique: true,
          references: { model: 'OrderItems', key: 'id' },
          onDelete: 'CASCADE',
        },
        outstandingQuantity: { type: DataTypes.INTEGER, allowNull: false },
        status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Open' },
        supplierConfirmedAt: { type: DataTypes.DATE, allowNull: true },
        estimatedFulfillmentAt: { type: DataTypes.DATE, allowNull: true },
        updatedByUserId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: { model: 'Users', key: 'id' },
          onDelete: 'SET NULL',
        },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
    }
    await addIndexIfMissing(queryInterface, 'ReplenishmentTasks', ['status'], {
      name: 'replenishment_tasks_status_idx',
    });

    if (!(await tableExists(queryInterface, 'OrderPaymentEvents'))) {
      await queryInterface.createTable('OrderPaymentEvents', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        eventId: { type: DataTypes.STRING(128), allowNull: false, unique: true },
        orderId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: 'Orders', key: 'id' },
          onDelete: 'CASCADE',
        },
        eventType: { type: DataTypes.STRING(32), allowNull: false },
        receivedAt: { type: DataTypes.DATE, allowNull: false },
        createdAt: { type: DataTypes.DATE, allowNull: false },
        updatedAt: { type: DataTypes.DATE, allowNull: false },
      });
    }
  },
};
