BEGIN;
CREATE TABLE IF NOT EXISTS inventory_materials (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES projects(id),
 item_code text NOT NULL DEFAULT '',
 name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 300),
 unit text NOT NULL DEFAULT '',
 source_key text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(project_id,source_key)
);
CREATE TABLE IF NOT EXISTS inventory_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 material_id uuid NOT NULL REFERENCES inventory_materials(id),
 kind text NOT NULL CHECK(kind IN ('opening','received','used','faulty')),
 quantity numeric(18,4) NOT NULL CHECK(quantity > 0),
 entry_date date NOT NULL,
 reference text NOT NULL DEFAULT '',
 actor_id uuid NOT NULL,
 mutation_id uuid NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_one_opening ON inventory_entries(material_id) WHERE kind='opening';
CREATE INDEX IF NOT EXISTS inventory_entries_material_date ON inventory_entries(material_id,entry_date);
ALTER TABLE inventory_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_entries ENABLE ROW LEVEL SECURITY;
-- Catalog seed follows below. No historical quantities are imported.
INSERT INTO inventory_materials(project_id,source_key,item_code,name,unit)
SELECT p.id,v.source_key,v.item_code,v.name,v.unit FROM projects p CROSS JOIN (VALUES
('dashboard-02','10000276','Cable4F,SM,Outdoor(4F/Tube),GPON','Meter'),
('dashboard-03','1000079','DRAWROPE,NO.1 500M/ 0.6 MM, BT 071830 CW','Meter'),
('dashboard-04','1000084','FIBER CAPPING','piece'),
('dashboard-05','1000085','FIBER CONNECTOR BEND','piece'),
('dashboard-06','1000105 /  1000223','Fiber Termination Box, 2F, SC,In/Outdoor','piece'),
('dashboard-07','1000087','Fiber Mechanical Splice, 1F, SM/MM(DELIVERY)','piece'),
('dashboard-08','10000466','Bare Fiber Protection Sleeve - Single 60mm','piece'),
('dashboard-09','10000389','WATERPROOF RUBBER SEAL','piece'),
('dashboard-10','1000086','FIBER HOUSE TERMINATION BOX,1F,SM,INDO (DELIVERY)','piece'),
('dashboard-11','1000021','BRACKET,NO.22,011114','piece'),
('dashboard-12','1000067','CLAMP,D/W NO.10A,(NYLON COATED STEEL WIR','piece'),
('dashboard-13','1000187','Quick SC/UPC Connector Blue for GPON (DELIVERY)','piece'),
('dashboard-14','1000040','CABLE 2F,GPON AERIAL DROP,BTC/1023/FIBER (DELIVERY)','Meter'),
('dashboard-15','1000185','QUICK SC CONNECTOR KIT FOR SM FIBRE (DELIVERY)','Kit'),
('dashboard-16','1000104','BNET-PIGTAIL-SM-SC/UPC-UNIVERSAL','piece'),
('dashboard-17','1000041','Cable2F,SM,Fully Filled,BTC/1021/Fibre','Meter'),
('dashboard-18','10000471 / 10000646','Huawei HG8245X6-8Ne-20 (WiFi-6) (DELIVERY)','piece'),
('dashboard-19','1000149 / 10000519','HUAWEI ECHOLIFE HG8M8240 H5','CARTONs'),
('dashboard-20','1000148','2G','piece'),
('dashboard-21','1000172','PATCH CORD HUAWEI ECHOLIFE HG8245 W5 (DELIVERY)','piece'),
('dashboard-22','1000173','PATCH CORD HUAWEI ECHOLIFE HG8M8240 H5 (DELIVERY)','piece'),
('dashboard-23','1000074','COMPOUND NO.16A, 1KG PACKETS 072136',''),
('dashboard-24','','20mm Piping','Meter'),
('dashboard-25','','16mm Trunking','Meter'),
('dashboard-26','1000022','CABLE DROPWIRE NO.10, CW1411','Meter'),
('dashboard-27','1000042','CABLE,2PR/0.5MM,TWISTED TCW PVC INSUL.WH','Meter'),
('dashboard-28','1000541','CABLE,2 PR/0.5MM ,LEADING_IN SP1068','Meter'),
('dashboard-29','1000553','JUMPER,2W/0.5,7000SERIES,(BLU/YL) 400M','Meter'),
('dashboard-30','1001965','PLUG 4-WIRE 6-POS AMERICAN TYPE WE4 LINE','EA'),
('dashboard-31','1001968','B.S PLUG 431A','EA'),
('dashboard-32','1000075','CONNECTOR,3M UR2 RED(IN CARTRIDGES)','EA'),
('dashboard-33','1004400','BOX PLASTIC PVC,3X3"(FOR LINE JACK UNIT)','EA'),
('dashboard-34','1004425','JACK LINE,UNIT 3/4A,MASTER (WITH LOGO)','EA'),
('dashboard-35','1004428','JACK,4/4A,MASTER,(WITH BATELCO LOGO)','EA'),
('dashboard-36','1000214','TP-LINK ARCHER VR600 AC1600','EA'),
('dashboard-37','1000068','CLIP 5-MM WHITE FOR DROPWIRE(100 /BOX)','EA'),
('dashboard-38','1000071','CLIP CABLE 6MM ROUND WHITE','Packet'),
('dashboard-39','1000207','STRAP CABLE THE 3M 10,NO 1ABT 072492','EA'),
('dashboard-40','1000213','TAPE PVC INSULATING SIZE 3/4,BLACK','Rolls'),
('dashboard-41','','RAWL,PLUG,PLASTIC,(6MM) 1*100',''),
('dashboard-42','1000192','SCREW,WOOD BRASS,1.5"NO.12 (1*100)','box'),
('dashboard-43','1000194','SCREW,WOOD BRASS,1.5"NO.12 (1*100)','Box'),
('dashboard-44','1000204','SPRAY, WD-40 400ML','EA'),
('dashboard-45','10000647','F50 AP K156a-21,Sub FTTR,UK              (FTTR AP-1 Serial Number)',''),
('dashboard-46','10000525','Invisible optical cable Bow Type',''),
('dashboard-47','10000524','ATB2121-S-5U-SC/APC indoor wall mounted',''),
('dashboard-48','1000186','QUICK SC/APC CONNECTOR GREEN FOR GPON',''),
('dashboard-49','10000527 (Main) Mater ONT F30','Huawei OptiXstar V183 a master FTTR for',''),
('dashboard-50','10000526 (F30)','Huawei OptiXstar K153-10 a master FTTR',''),
('dashboard-51','10000666','Huawei Fiber Installation Kit (FTTR)',''),
('dashboard-52','10000667','Corner Cable Supporter Clips (FTTR)',''),
('dashboard-53','10000668','Wall Cable Supporter Clips (FTTR)',''),
('dashboard-54','10000522','ATB2120-T-1-SA for fiber & drum storing','')
) AS v(source_key,item_code,name,unit) WHERE p.code='SERVICE_ASSURANCE'
ON CONFLICT(project_id,source_key) DO NOTHING;
COMMIT;
