-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('LOGISTICS_COMMANDER', 'LOGISTICS_SOLDIER', 'TEAM_LEAD');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('UNIT', 'BRANCH', 'SECTION');

-- CreateEnum
CREATE TYPE "MappingStatus" AS ENUM ('MAPPED', 'NOT_MAPPED');

-- CreateEnum
CREATE TYPE "DoorSide" AS ENUM ('NORTH', 'SOUTH', 'EAST', 'WEST');

-- CreateEnum
CREATE TYPE "TrackingMode" AS ENUM ('SERIALIZED', 'BULK');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('AVAILABLE', 'RESERVED_FOR_TASK', 'PACKED', 'IN_TRANSIT', 'RECEIVED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "PackingTaskStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PackageType" AS ENUM ('PROFESSIONAL_BOX', 'PERSONAL_BOX', 'PALLET', 'CRATE', 'BULK_CONTAINER');

-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('OPEN', 'SEALED', 'READY_FOR_SHIPMENT', 'ASSIGNED_TO_MISSION', 'IN_TRANSIT', 'RECEIVED_AT_HUB', 'DELIVERED_TO_ROOM');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('TRUCK', 'OTHER');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('DRAFT', 'PLANNED', 'LOADING', 'IN_TRANSIT', 'UNLOADING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StopType" AS ENUM ('START', 'PICKUP', 'DELIVERY_HUB', 'END');

-- CreateEnum
CREATE TYPE "StopStatus" AS ENUM ('PLANNED', 'ARRIVED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "identityNumber" VARCHAR(20) NOT NULL,
    "fullName" VARCHAR(120) NOT NULL,
    "email" VARCHAR(120) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "baseId" UUID,
    "teamId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Base" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "addressText" VARCHAR(200) NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "isDestinationHub" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Base_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationalUnit" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "baseId" UUID NOT NULL,
    "parentId" UUID,
    "type" "UnitType" NOT NULL DEFAULT 'UNIT',

    CONSTRAINT "OrganizationalUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "unitId" UUID NOT NULL,
    "leadUserId" UUID,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" UUID NOT NULL,
    "baseId" UUID NOT NULL,
    "unitId" UUID,
    "teamId" UUID,
    "building" VARCHAR(80) NOT NULL,
    "floor" VARCHAR(10) NOT NULL,
    "roomNumber" VARCHAR(20) NOT NULL,
    "displayName" VARCHAR(120) NOT NULL,
    "floorMapId" UUID,
    "mappingStatus" "MappingStatus" NOT NULL DEFAULT 'MAPPED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloorMap" (
    "id" UUID NOT NULL,
    "baseId" UUID NOT NULL,
    "building" VARCHAR(80) NOT NULL,
    "floorNumber" INTEGER NOT NULL,
    "displayName" VARCHAR(120) NOT NULL,
    "canvasWidth" INTEGER NOT NULL DEFAULT 1000,
    "canvasHeight" INTEGER NOT NULL DEFAULT 600,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "FloorMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomMapShape" (
    "id" UUID NOT NULL,
    "floorMapId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "doorSide" "DoorSide" NOT NULL DEFAULT 'SOUTH',
    "zone" VARCHAR(60),

    CONSTRAINT "RoomMapShape_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCatalogItem" (
    "id" UUID NOT NULL,
    "sku" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "category" VARCHAR(60) NOT NULL,
    "trackingMode" "TrackingMode" NOT NULL,
    "unitOfMeasure" VARCHAR(20) NOT NULL DEFAULT 'יח׳',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetInstance" (
    "id" UUID NOT NULL,
    "assetTag" VARCHAR(60) NOT NULL,
    "productCatalogItemId" UUID NOT NULL,
    "ownerName" VARCHAR(120) NOT NULL,
    "ownerIdentityNumber" VARCHAR(20),
    "currentRoomId" UUID,
    "status" "AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "reservedForTaskId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomInventory" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "productCatalogItemId" UUID NOT NULL,
    "mappedQuantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "packedQuantity" INTEGER NOT NULL DEFAULT 0,
    "deliveredQuantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RoomInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackingTask" (
    "id" UUID NOT NULL,
    "taskNumber" VARCHAR(20) NOT NULL,
    "sourceRoomId" UUID NOT NULL,
    "destinationRoomId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "assignedSoldierId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "dueAt" TIMESTAMP(3),
    "notes" VARCHAR(1000),
    "status" "PackingTaskStatus" NOT NULL DEFAULT 'ASSIGNED',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackingTaskLine" (
    "id" UUID NOT NULL,
    "packingTaskId" UUID NOT NULL,
    "productCatalogItemId" UUID NOT NULL,
    "assetInstanceId" UUID,
    "requestedQuantity" INTEGER NOT NULL,
    "packedQuantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PackingTaskLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" UUID NOT NULL,
    "packageNumber" VARCHAR(20) NOT NULL,
    "publicToken" VARCHAR(120) NOT NULL,
    "packingTaskId" UUID NOT NULL,
    "sourceRoomId" UUID NOT NULL,
    "destinationRoomId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "packageType" "PackageType" NOT NULL DEFAULT 'PROFESSIONAL_BOX',
    "status" "PackageStatus" NOT NULL DEFAULT 'OPEN',
    "notes" VARCHAR(1000),
    "sealedAt" TIMESTAMP(3),
    "departedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageAsset" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "assetInstanceId" UUID NOT NULL,
    "assetTagSnapshot" VARCHAR(60) NOT NULL,
    "productNameSnapshot" VARCHAR(120) NOT NULL,
    "ownerNameSnapshot" VARCHAR(120) NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageBulkLine" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "productCatalogItemId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageBulkLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageStatusEvent" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "fromStatus" "PackageStatus",
    "toStatus" "PackageStatus" NOT NULL,
    "actorUserId" UUID NOT NULL,
    "missionId" UUID,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportMission" (
    "id" UUID NOT NULL,
    "missionNumber" VARCHAR(20) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "createdById" UUID NOT NULL,
    "assignedSoldierId" UUID,
    "vehicleType" "VehicleType" NOT NULL DEFAULT 'TRUCK',
    "vehicleDetails" VARCHAR(200),
    "licensePlate" VARCHAR(20),
    "requiresSecuredTransport" BOOLEAN NOT NULL DEFAULT false,
    "securedTransportNotes" VARCHAR(1000),
    "plannedDepartureAt" TIMESTAMP(3) NOT NULL,
    "actualDepartureAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" "MissionStatus" NOT NULL DEFAULT 'DRAFT',
    "routeDistanceKmEstimate" DECIMAL(8,2),
    "routeDurationMinutesEstimate" INTEGER,
    "optimizationScore" DECIMAL(6,2),
    "routeExplanation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportMission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionStop" (
    "id" UUID NOT NULL,
    "transportMissionId" UUID NOT NULL,
    "baseId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "stopType" "StopType" NOT NULL,
    "status" "StopStatus" NOT NULL DEFAULT 'PLANNED',
    "plannedAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MissionStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionPackage" (
    "id" UUID NOT NULL,
    "transportMissionId" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "pickupStopId" UUID NOT NULL,
    "loadedAt" TIMESTAMP(3),
    "unloadedAt" TIMESTAMP(3),
    "loadedById" UUID,
    "unloadedById" UUID,

    CONSTRAINT "MissionPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionJoinRequest" (
    "id" UUID NOT NULL,
    "transportMissionId" UUID NOT NULL,
    "requestingUserId" UUID NOT NULL,
    "baseId" UUID NOT NULL,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "note" VARCHAR(1000),
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionJoinRequestPackage" (
    "id" UUID NOT NULL,
    "joinRequestId" UUID NOT NULL,
    "packageId" UUID NOT NULL,

    CONSTRAINT "MissionJoinRequestPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "action" VARCHAR(60) NOT NULL,
    "entityType" VARCHAR(60) NOT NULL,
    "entityId" UUID,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" UUID NOT NULL,
    "scope" VARCHAR(60) NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "userId" UUID NOT NULL,
    "entityId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_identityNumber_key" ON "User"("identityNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_baseId_idx" ON "User"("baseId");

-- CreateIndex
CREATE INDEX "User_teamId_idx" ON "User"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshSession_tokenHash_key" ON "RefreshSession"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshSession_userId_expiresAt_idx" ON "RefreshSession"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Base_code_key" ON "Base"("code");

-- CreateIndex
CREATE INDEX "Base_isDestinationHub_idx" ON "Base"("isDestinationHub");

-- CreateIndex
CREATE INDEX "OrganizationalUnit_parentId_idx" ON "OrganizationalUnit"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationalUnit_baseId_code_key" ON "OrganizationalUnit"("baseId", "code");

-- CreateIndex
CREATE INDEX "Team_leadUserId_idx" ON "Team"("leadUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_unitId_code_key" ON "Team"("unitId", "code");

-- CreateIndex
CREATE INDEX "Room_teamId_idx" ON "Room"("teamId");

-- CreateIndex
CREATE INDEX "Room_floorMapId_idx" ON "Room"("floorMapId");

-- CreateIndex
CREATE INDEX "Room_baseId_building_floor_idx" ON "Room"("baseId", "building", "floor");

-- CreateIndex
CREATE UNIQUE INDEX "Room_baseId_building_floor_roomNumber_key" ON "Room"("baseId", "building", "floor", "roomNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FloorMap_baseId_building_floorNumber_key" ON "FloorMap"("baseId", "building", "floorNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMapShape_roomId_key" ON "RoomMapShape"("roomId");

-- CreateIndex
CREATE INDEX "RoomMapShape_floorMapId_idx" ON "RoomMapShape"("floorMapId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCatalogItem_sku_key" ON "ProductCatalogItem"("sku");

-- CreateIndex
CREATE INDEX "ProductCatalogItem_category_idx" ON "ProductCatalogItem"("category");

-- CreateIndex
CREATE INDEX "ProductCatalogItem_trackingMode_idx" ON "ProductCatalogItem"("trackingMode");

-- CreateIndex
CREATE UNIQUE INDEX "AssetInstance_assetTag_key" ON "AssetInstance"("assetTag");

-- CreateIndex
CREATE INDEX "AssetInstance_currentRoomId_idx" ON "AssetInstance"("currentRoomId");

-- CreateIndex
CREATE INDEX "AssetInstance_status_idx" ON "AssetInstance"("status");

-- CreateIndex
CREATE INDEX "AssetInstance_ownerName_idx" ON "AssetInstance"("ownerName");

-- CreateIndex
CREATE INDEX "AssetInstance_productCatalogItemId_idx" ON "AssetInstance"("productCatalogItemId");

-- CreateIndex
CREATE INDEX "RoomInventory_productCatalogItemId_idx" ON "RoomInventory"("productCatalogItemId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomInventory_roomId_productCatalogItemId_key" ON "RoomInventory"("roomId", "productCatalogItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PackingTask_taskNumber_key" ON "PackingTask"("taskNumber");

-- CreateIndex
CREATE INDEX "PackingTask_assignedSoldierId_idx" ON "PackingTask"("assignedSoldierId");

-- CreateIndex
CREATE INDEX "PackingTask_status_idx" ON "PackingTask"("status");

-- CreateIndex
CREATE INDEX "PackingTask_sourceRoomId_idx" ON "PackingTask"("sourceRoomId");

-- CreateIndex
CREATE INDEX "PackingTask_teamId_idx" ON "PackingTask"("teamId");

-- CreateIndex
CREATE INDEX "PackingTask_priority_createdAt_idx" ON "PackingTask"("priority", "createdAt");

-- CreateIndex
CREATE INDEX "PackingTaskLine_packingTaskId_idx" ON "PackingTaskLine"("packingTaskId");

-- CreateIndex
CREATE INDEX "PackingTaskLine_assetInstanceId_idx" ON "PackingTaskLine"("assetInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "Package_packageNumber_key" ON "Package"("packageNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Package_publicToken_key" ON "Package"("publicToken");

-- CreateIndex
CREATE INDEX "Package_status_idx" ON "Package"("status");

-- CreateIndex
CREATE INDEX "Package_teamId_idx" ON "Package"("teamId");

-- CreateIndex
CREATE INDEX "Package_destinationRoomId_idx" ON "Package"("destinationRoomId");

-- CreateIndex
CREATE INDEX "Package_packingTaskId_idx" ON "Package"("packingTaskId");

-- CreateIndex
CREATE INDEX "Package_sourceRoomId_status_idx" ON "Package"("sourceRoomId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PackageAsset_assetInstanceId_key" ON "PackageAsset"("assetInstanceId");

-- CreateIndex
CREATE INDEX "PackageAsset_packageId_idx" ON "PackageAsset"("packageId");

-- CreateIndex
CREATE INDEX "PackageBulkLine_packageId_idx" ON "PackageBulkLine"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageBulkLine_packageId_productCatalogItemId_key" ON "PackageBulkLine"("packageId", "productCatalogItemId");

-- CreateIndex
CREATE INDEX "PackageStatusEvent_packageId_createdAt_idx" ON "PackageStatusEvent"("packageId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TransportMission_missionNumber_key" ON "TransportMission"("missionNumber");

-- CreateIndex
CREATE INDEX "TransportMission_status_idx" ON "TransportMission"("status");

-- CreateIndex
CREATE INDEX "TransportMission_plannedDepartureAt_idx" ON "TransportMission"("plannedDepartureAt");

-- CreateIndex
CREATE INDEX "TransportMission_assignedSoldierId_idx" ON "TransportMission"("assignedSoldierId");

-- CreateIndex
CREATE INDEX "MissionStop_transportMissionId_sequence_idx" ON "MissionStop"("transportMissionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "MissionStop_transportMissionId_sequence_key" ON "MissionStop"("transportMissionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "MissionPackage_packageId_key" ON "MissionPackage"("packageId");

-- CreateIndex
CREATE INDEX "MissionPackage_transportMissionId_idx" ON "MissionPackage"("transportMissionId");

-- CreateIndex
CREATE INDEX "MissionPackage_pickupStopId_idx" ON "MissionPackage"("pickupStopId");

-- CreateIndex
CREATE INDEX "MissionJoinRequest_status_idx" ON "MissionJoinRequest"("status");

-- CreateIndex
CREATE INDEX "MissionJoinRequest_transportMissionId_idx" ON "MissionJoinRequest"("transportMissionId");

-- CreateIndex
CREATE INDEX "MissionJoinRequest_requestingUserId_idx" ON "MissionJoinRequest"("requestingUserId");

-- CreateIndex
CREATE INDEX "MissionJoinRequestPackage_packageId_idx" ON "MissionJoinRequestPackage"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "MissionJoinRequestPackage_joinRequestId_packageId_key" ON "MissionJoinRequestPackage"("joinRequestId", "packageId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_createdAt_idx" ON "IdempotencyRecord"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_scope_key_userId_key" ON "IdempotencyRecord"("scope", "key", "userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "Base"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationalUnit" ADD CONSTRAINT "OrganizationalUnit_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "Base"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationalUnit" ADD CONSTRAINT "OrganizationalUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrganizationalUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrganizationalUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_leadUserId_fkey" FOREIGN KEY ("leadUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "Base"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "OrganizationalUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_floorMapId_fkey" FOREIGN KEY ("floorMapId") REFERENCES "FloorMap"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorMap" ADD CONSTRAINT "FloorMap_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "Base"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMapShape" ADD CONSTRAINT "RoomMapShape_floorMapId_fkey" FOREIGN KEY ("floorMapId") REFERENCES "FloorMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMapShape" ADD CONSTRAINT "RoomMapShape_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetInstance" ADD CONSTRAINT "AssetInstance_productCatalogItemId_fkey" FOREIGN KEY ("productCatalogItemId") REFERENCES "ProductCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetInstance" ADD CONSTRAINT "AssetInstance_currentRoomId_fkey" FOREIGN KEY ("currentRoomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetInstance" ADD CONSTRAINT "AssetInstance_reservedForTaskId_fkey" FOREIGN KEY ("reservedForTaskId") REFERENCES "PackingTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomInventory" ADD CONSTRAINT "RoomInventory_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomInventory" ADD CONSTRAINT "RoomInventory_productCatalogItemId_fkey" FOREIGN KEY ("productCatalogItemId") REFERENCES "ProductCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingTask" ADD CONSTRAINT "PackingTask_sourceRoomId_fkey" FOREIGN KEY ("sourceRoomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingTask" ADD CONSTRAINT "PackingTask_destinationRoomId_fkey" FOREIGN KEY ("destinationRoomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingTask" ADD CONSTRAINT "PackingTask_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingTask" ADD CONSTRAINT "PackingTask_assignedSoldierId_fkey" FOREIGN KEY ("assignedSoldierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingTask" ADD CONSTRAINT "PackingTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingTaskLine" ADD CONSTRAINT "PackingTaskLine_packingTaskId_fkey" FOREIGN KEY ("packingTaskId") REFERENCES "PackingTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingTaskLine" ADD CONSTRAINT "PackingTaskLine_productCatalogItemId_fkey" FOREIGN KEY ("productCatalogItemId") REFERENCES "ProductCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingTaskLine" ADD CONSTRAINT "PackingTaskLine_assetInstanceId_fkey" FOREIGN KEY ("assetInstanceId") REFERENCES "AssetInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_packingTaskId_fkey" FOREIGN KEY ("packingTaskId") REFERENCES "PackingTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_sourceRoomId_fkey" FOREIGN KEY ("sourceRoomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_destinationRoomId_fkey" FOREIGN KEY ("destinationRoomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageAsset" ADD CONSTRAINT "PackageAsset_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageAsset" ADD CONSTRAINT "PackageAsset_assetInstanceId_fkey" FOREIGN KEY ("assetInstanceId") REFERENCES "AssetInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageBulkLine" ADD CONSTRAINT "PackageBulkLine_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageBulkLine" ADD CONSTRAINT "PackageBulkLine_productCatalogItemId_fkey" FOREIGN KEY ("productCatalogItemId") REFERENCES "ProductCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageStatusEvent" ADD CONSTRAINT "PackageStatusEvent_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageStatusEvent" ADD CONSTRAINT "PackageStatusEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageStatusEvent" ADD CONSTRAINT "PackageStatusEvent_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "TransportMission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportMission" ADD CONSTRAINT "TransportMission_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportMission" ADD CONSTRAINT "TransportMission_assignedSoldierId_fkey" FOREIGN KEY ("assignedSoldierId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionStop" ADD CONSTRAINT "MissionStop_transportMissionId_fkey" FOREIGN KEY ("transportMissionId") REFERENCES "TransportMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionStop" ADD CONSTRAINT "MissionStop_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "Base"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionPackage" ADD CONSTRAINT "MissionPackage_transportMissionId_fkey" FOREIGN KEY ("transportMissionId") REFERENCES "TransportMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionPackage" ADD CONSTRAINT "MissionPackage_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionPackage" ADD CONSTRAINT "MissionPackage_pickupStopId_fkey" FOREIGN KEY ("pickupStopId") REFERENCES "MissionStop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionPackage" ADD CONSTRAINT "MissionPackage_loadedById_fkey" FOREIGN KEY ("loadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionPackage" ADD CONSTRAINT "MissionPackage_unloadedById_fkey" FOREIGN KEY ("unloadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionJoinRequest" ADD CONSTRAINT "MissionJoinRequest_transportMissionId_fkey" FOREIGN KEY ("transportMissionId") REFERENCES "TransportMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionJoinRequest" ADD CONSTRAINT "MissionJoinRequest_requestingUserId_fkey" FOREIGN KEY ("requestingUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionJoinRequest" ADD CONSTRAINT "MissionJoinRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionJoinRequest" ADD CONSTRAINT "MissionJoinRequest_baseId_fkey" FOREIGN KEY ("baseId") REFERENCES "Base"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionJoinRequestPackage" ADD CONSTRAINT "MissionJoinRequestPackage_joinRequestId_fkey" FOREIGN KEY ("joinRequestId") REFERENCES "MissionJoinRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionJoinRequestPackage" ADD CONSTRAINT "MissionJoinRequestPackage_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

