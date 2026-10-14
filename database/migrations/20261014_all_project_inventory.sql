BEGIN;
-- Catalog only: preserve existing stock and do not import historical workbook quantities.
-- SERVICE_DELIVERY is the stable internal code for the renamed Service Assurance project.
INSERT INTO inventory_materials(project_id,source_key,item_code,name,unit)
SELECT p.id,v.source_key,v.item_code,v.name,v.unit FROM projects p CROSS JOIN (VALUES
('assurance-dashboard-2026-02','10000276','Cable, Fiber Drop in Duct Cable, 4F GJYX','Meter'),
('assurance-dashboard-2026-03','1000079','DRAWROPE,NO.1 500M/ 0.6 MM, BT 071830 CW','Meter'),
('assurance-dashboard-2026-04','1000084','FIBER CAPPING','piece'),
('assurance-dashboard-2026-05','1000085','FIBER CONNECTOR BEND','piece'),
('assurance-dashboard-2026-06','1000105','Fiber Termination Box, 2F, SC,In/Outdoor','piece'),
('assurance-dashboard-2026-07','1000087','Fiber Mechanical Splice, 1F, SM/MM','piece'),
('assurance-dashboard-2026-08','10000466','Fiber Sleeves','piece'),
('assurance-dashboard-2026-09','10000389','Rubber Block Plug for Dome Heat Shrink','piece'),
('assurance-dashboard-2026-10','1000086','FIBER HOUSE TERMINATION BOX,1F,SM,INDO','piece'),
('assurance-dashboard-2026-11','1000021','BRACKET,NO.22,011114','piece'),
('assurance-dashboard-2026-12','1000067','CLAMP,D/W NO.10A,(NYLON COATED STEEL WIR','piece'),
('assurance-dashboard-2026-13','1000187','Quick SC/UPC Connector Blue for GPON','piece'),
('assurance-dashboard-2026-14','1000040','CABLE 2F,GPON AERIAL DROP,BTC/1023/FIBER','piece'),
('assurance-dashboard-2026-15','1000185','QUICK SC CONNECTOR KIT FOR SM FIBRE','Kit'),
('assurance-dashboard-2026-16','1000104','BNET-PIGTAIL-SM-SC/UPC-UNIVERSAL','piece'),
('assurance-dashboard-2026-17','1000041','Cable2F,SM,Fully Filled,BTC/1021/Fibre','Meter'),
('assurance-dashboard-2026-18','1000148 / 10000471','ONT - Bnet WiFi 6','piece'),
('assurance-dashboard-2026-19','1000149','ONT - Bnet H5','piece'),
('assurance-dashboard-2026-20','1000148','ONT -2G','piece'),
('assurance-dashboard-2026-21','1000172','Patch Cord SC -SC 3m W5','piece'),
('assurance-dashboard-2026-22','1000173','PATCH CORD HUAWEI ECHOLIFE HG8M8240 H5 (DELIVERY)','piece'),
('assurance-dashboard-2026-23','1000074','COMPOUND NO.16A, 1KG PACKETS 072136',''),
('assurance-dashboard-2026-24','','Quick SC/APC Connector Green for GPON','piece'),
('assurance-dashboard-2026-25','1000001','ADAPTER, SIMPLEX SC, BLUE PLASTIC','piece'),
('assurance-dashboard-2026-26','1000098','FIBER PATCH CORD,SC/SCSM, DUPLEX, 4M','piece'),
('assurance-dashboard-2026-27','1000092','FIBER PATCH CORD,SC/LC SM, DUPLEX,4M','piece'),
('assurance-dashboard-2026-28','1000022','CABLE DROPWIRE NO.10, CW1411','Meter'),
('assurance-dashboard-2026-29','1000042','CABLE,2PR/0.5MM,TWISTED TCW PVC INSUL.WH','Meter'),
('assurance-dashboard-2026-30','1000541','CABLE,2 PR/0.5MM ,LEADING_IN SP1068','Meter'),
('assurance-dashboard-2026-31','1000553','JUMPER,2W/0.5,7000SERIES,(BLU/YL) 400M','Meter'),
('assurance-dashboard-2026-32','1001965','PLUG 4-WIRE 6-POS AMERICAN TYPE WE4 LINE','EA'),
('assurance-dashboard-2026-33','1001968','B.S PLUG 431A','EA'),
('assurance-dashboard-2026-34','1004110','CONNECTOR,3M UR2 RED(IN CARTRIDGES)','EA'),
('assurance-dashboard-2026-35','1004400','BOX PLASTIC PVC,3X3"(FOR LINE JACK UNIT)','EA'),
('assurance-dashboard-2026-36','1004425','JACK LINE,UNIT 3/4A,MASTER (MIX LOGO AND WHITOUT )','EA'),
('assurance-dashboard-2026-37','1004428','JACK,4/4A,MASTER,(WITH BNET LOGO)','EA'),
('assurance-dashboard-2026-38','1000214','TP-LINK ARCHER VR600 AC1600','EA'),
('assurance-dashboard-2026-39','1000182','PLUG, AMERICAN, 8 WIRES 8 POS, ( RJ45 )','EA'),
('assurance-dashboard-2026-40','1000068','CLIP 5+MM WHITE FOR DROPWIRE (100/BOX)','PAC'),
('assurance-dashboard-2026-41','1000070','CLIP CABLE,4.5MM (UNIFIX) WHITE','PAC'),
('assurance-dashboard-2026-42','1000188','RAWL,PLUG,PLASTIC,NO.3(6MM DRILL BIT).','PAC'),
('assurance-dashboard-2026-43','1000069','CLIP CABLE , 3.5MM (UNIFIX) WHITE.','PAC'),
('assurance-dashboard-2026-44','1000071','CLIP CABLE,6MM ROUND WHITE','PAC'),
('assurance-dashboard-2026-45','1000192','SCREW,WOOD BRASS,1 1/2 NO.8','PAC'),
('assurance-dashboard-2026-46','1000213','TAPE,PVC INSULATING, SIZE 3/4", BLACK','EA'),
('assurance-dashboard-2026-47','1000207','STRAP CABLE TIE 3M,10",NO.1A BT 072492','PAC'),
('assurance-dashboard-2026-48','1000189','RAWL,PLUG,PLASTIC,NO.4(7MM DRILL BIT).','PAC'),
('assurance-dashboard-2026-49','1000194','SCREW,WOOD BRASS,1.5"NO.12','PAC'),
('assurance-dashboard-2026-50','1000204','SPRAY, WD-40 400ML','EA')
) AS v(source_key,item_code,name,unit)
WHERE p.code='SERVICE_DELIVERY'
AND NOT EXISTS (SELECT 1 FROM inventory_materials m WHERE m.project_id=p.id
 AND lower(trim(m.item_code))=lower(trim(v.item_code)) AND lower(trim(m.name))=lower(trim(v.name)))
ON CONFLICT(project_id,source_key) DO NOTHING;
COMMIT;
