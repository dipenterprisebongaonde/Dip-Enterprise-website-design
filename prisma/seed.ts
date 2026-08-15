import { InventoryCategory, PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.inventoryMovement.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.vehicleRoutePoint.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.camera.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.setting.deleteMany();

  const hq = await prisma.branch.create({
    data: {
      name: "Bongaon HQ",
      region: "West Bengal",
      address: "Bongaon, West Bengal",
      bankName: "State Bank of India",
      accountNo: "XXXXXX4521",
      ifsc: "SBIN0001234",
      bankBranch: "Bongaon",
      upi: "dipenterprise@upi",
    },
  });

  const north = await prisma.branch.create({
    data: {
      name: "North Hub",
      region: "North Zone",
      address: "North Region Depot",
      bankName: "HDFC Bank",
      accountNo: "XXXXXX8890",
      ifsc: "HDFC0002211",
      bankBranch: "North Hub",
      upi: "dipnorth@upi",
    },
  });

  const adminHash = await bcrypt.hash("Admin@123", 10);
  const staffHash = await bcrypt.hash("Staff@123", 10);

  await prisma.user.create({
    data: {
      email: "admin@dipenterprise.com",
      phone: "+919000011111",
      passwordHash: adminHash,
      name: "Super Admin",
      role: Role.SUPER_ADMIN,
    },
  });

  await prisma.user.create({
    data: {
      email: "staff@dipenterprise.com",
      phone: "+919000022222",
      passwordHash: staffHash,
      name: "Branch Staff",
      role: Role.STAFF,
      branchId: hq.id,
    },
  });

  const vendor = await prisma.vendor.create({
    data: {
      name: "Orbit Supplies",
      email: "sales@orbitsupplies.com",
      phone: "+91 90000 11111",
      branchId: hq.id,
    },
  });

  const customer = await prisma.customer.create({
    data: {
      name: "Metro Retail",
      email: "accounts@metroretail.com",
      phone: "+91 90000 22222",
      branchId: hq.id,
    },
  });

  await prisma.purchase.create({
    data: {
      invoiceNo: "PUR 26-27/0001",
      invoiceDate: new Date(),
      item: "Surveillance Kits",
      quantity: 12,
      unitPrice: 7000,
      amount: 84000,
      paidAmount: 84000,
      paymentStatus: "PAID",
      vendorId: vendor.id,
      branchId: hq.id,
      payments: {
        create: {
          amount: 84000,
          note: "Initial payment",
        },
      },
    },
  });

  await prisma.sale.create({
    data: {
      invoiceNo: "INV 26-27/0001",
      invoiceDate: new Date(),
      item: "Fleet Tracking Subscription",
      quantity: 5,
      unitPrice: 9000,
      amount: 45000,
      paidAmount: 45000,
      paymentStatus: "PAID",
      customerId: customer.id,
      branchId: hq.id,
      payments: {
        create: {
          amount: 45000,
          note: "Initial payment",
        },
      },
    },
  });

  await prisma.camera.createMany({
    data: [
      {
        name: "Gate Cam 01",
        location: "Main Entrance",
        status: "online",
        streamUrl: "https://example.com/stream/gate-01",
        branchId: hq.id,
      },
      {
        name: "Yard Cam 02",
        location: "Parking Yard",
        status: "online",
        streamUrl: "https://example.com/stream/yard-02",
        branchId: hq.id,
      },
      {
        name: "Warehouse Cam 03",
        location: "Warehouse A",
        status: "offline",
        branchId: north.id,
      },
    ],
  });

  const vehicle = await prisma.vehicle.create({
    data: {
      plateNumber: "WB26 AB 4521",
      model: "Tata Ace",
      driverName: "Ravi Kumar",
      engineOn: true,
      speedKmh: 42,
      latitude: 22.8475,
      longitude: 88.7594,
      status: "moving",
      branchId: hq.id,
    },
  });

  await prisma.vehicle.create({
    data: {
      plateNumber: "WB26 CD 1188",
      model: "Mahindra Bolero",
      driverName: "Amit Das",
      engineOn: false,
      speedKmh: 0,
      latitude: 22.86,
      longitude: 88.75,
      status: "parked",
      branchId: hq.id,
    },
  });

  await prisma.vehicleRoutePoint.createMany({
    data: [
      {
        vehicleId: vehicle.id,
        latitude: 22.84,
        longitude: 88.75,
        speedKmh: 30,
      },
      {
        vehicleId: vehicle.id,
        latitude: 22.845,
        longitude: 88.755,
        speedKmh: 38,
      },
      {
        vehicleId: vehicle.id,
        latitude: 22.8475,
        longitude: 88.7594,
        speedKmh: 42,
      },
    ],
  });

  const camKit = await prisma.inventoryItem.create({
    data: {
      sku: "CCTV-KIT-01",
      name: "4-Channel DVR Kit",
      category: InventoryCategory.SECURITY_GEAR,
      description: "Complete DVR kit with 4 bullet cameras",
      quantity: 18,
      unit: "set",
      reorderLevel: 6,
      unitCost: 12500,
      location: "Warehouse A / Rack 2",
      branchId: hq.id,
    },
  });

  await prisma.inventoryItem.createMany({
    data: [
      {
        sku: "GPS-TRK-22",
        name: "GPS Tracker Module",
        category: InventoryCategory.FLEET_SUPPLIES,
        description: "Vehicle GPS tracker with SIM slot",
        quantity: 4,
        unit: "pcs",
        reorderLevel: 8,
        unitCost: 3200,
        location: "Fleet Bay",
        branchId: hq.id,
      },
      {
        sku: "CAM-BUL-08",
        name: "Outdoor Bullet Camera",
        category: InventoryCategory.ELECTRONICS,
        quantity: 42,
        unit: "pcs",
        reorderLevel: 15,
        unitCost: 2100,
        location: "Warehouse A / Rack 1",
        branchId: hq.id,
      },
      {
        sku: "CAB-RG6-100",
        name: "RG6 Coaxial Cable (100m)",
        category: InventoryCategory.SPARE_PARTS,
        quantity: 2,
        unit: "roll",
        reorderLevel: 5,
        unitCost: 1800,
        location: "Parts Bin",
        branchId: north.id,
      },
      {
        sku: "OFF-HDD-1TB",
        name: "Surveillance HDD 1TB",
        category: InventoryCategory.ELECTRONICS,
        quantity: 11,
        unit: "pcs",
        reorderLevel: 4,
        unitCost: 4500,
        location: "IT Store",
        branchId: north.id,
      },
    ],
  });

  await prisma.inventoryMovement.createMany({
    data: [
      {
        itemId: camKit.id,
        type: "IN",
        quantity: 20,
        note: "Opening stock",
      },
      {
        itemId: camKit.id,
        type: "OUT",
        quantity: 2,
        note: "Issued to installation team",
      },
    ],
  });

  await prisma.setting.create({
    data: {
      id: "global",
      cctvLoginUrl: "https://example.com/cctv-login",
      companyMotto: "Secure. Track. Operate.",
      platformName: "DIP Enterprise Cloud",
      companyName: "DIP ENTERPRISE",
      legalName: "DIP Enterprise Cloud",
      address: "Bongaon, West Bengal, India",
      phone: "+91 90000 00000",
      email: "dipenterprise.bongaon.de@gmail.com",
      gstin: "",
      enableGst: false,
      gstPercent: 18,
      logoUrl: "/logo.png",
      bankName: "State Bank of India",
      accountNo: "XXXXXX4521",
      ifsc: "SBIN0001234",
      bankBranch: "Bongaon",
      upi: "dipenterprise@upi",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

