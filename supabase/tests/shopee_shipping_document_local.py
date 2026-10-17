import subprocess, pathlib, json, concurrent.futures, time, sys, uuid
root=pathlib.Path(sys.argv[1]); name='f6o3-document-postgres-'+uuid.uuid4().hex[:8]
def sql(s,role=None,check=True):
    p=subprocess.run(['docker','exec','-i',name,'psql','-U','postgres','-d','proof','-X','-q','-t','-A','-v','ON_ERROR_STOP=1'],input=('SET ROLE '+role+';\n' if role else '')+s,text=True,capture_output=True)
    if check and p.returncode: raise AssertionError(p.stderr)
    return p
account='11111111-1111-4111-8111-111111111111'; order='33333333-3333-4333-8333-333333333333'; fingerprint='a'*64
def claim(pkg='CONCURRENT',shop=123,acct=account,key=fingerprint):
    p=sql("SELECT claim_shopee_shipping_document('%s',%d,'SYNTHETIC123','%s','NORMAL_AIR_WAYBILL','%s');"%(acct,shop,pkg,key),'service_role')
    return json.loads(p.stdout.strip().splitlines()[-1])
try:
    subprocess.run(['docker','run','-d','--name',name,'--network=none','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_PASSWORD=synthetic-local-only','-e','POSTGRES_DB=proof','postgres:17-alpine'],check=True,capture_output=True)
    for _ in range(30):
        if subprocess.run(['docker','exec',name,'pg_isready','-U','postgres','-d','proof'],capture_output=True).returncode==0:break
        time.sleep(1)
    else:raise AssertionError('Postgres not ready')
    sql("""
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE TABLE digital_platforms(id uuid PRIMARY KEY,is_active boolean,group_type text,parent_id uuid,name text);
CREATE TABLE channel_accounts(id uuid PRIMARY KEY,platform_id uuid,is_active boolean);
CREATE TABLE shopee_oauth_connections(channel_account_id uuid,shop_id bigint,environment text);
CREATE TABLE orders(id uuid PRIMARY KEY,channel_account_id uuid,order_number text,channel text,sale_origin text,deleted_at timestamptz);
CREATE TABLE order_documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid,document_type text);
INSERT INTO digital_platforms VALUES('44444444-4444-4444-8444-444444444444',true,'marketplace',null,'Shopee');
INSERT INTO channel_accounts VALUES('11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444',true),('22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444',false);
INSERT INTO shopee_oauth_connections VALUES('11111111-1111-4111-8111-111111111111',123,'live');
INSERT INTO orders VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','SYNTHETIC123','shopee','shopee_open_platform',null);
""")
    sql((root/'supabase/migrations/20261016220000_shopee_shipping_document_idempotency.sql').read_text(encoding='utf-8-sig'))
    print('LOCAL_MIGRATION=PASS',flush=True)
    sql((root/'supabase/tests/shopee_shipping_document_idempotency.sql').read_text())
    print('SQL_ROLLBACK_TEST=PASS',flush=True)
    for role in ['anon','authenticated']:
        for query in ["SELECT claim_shopee_shipping_document('%s',123,'SYNTHETIC123','PK','NORMAL_AIR_WAYBILL','%s');"%(account,fingerprint),"SELECT resolve_shopee_shipping_document('%s','%s','succeeded');"%(order,fingerprint),'SELECT * FROM shopee_shipping_document_attempts;',"INSERT INTO shopee_shipping_document_attempts DEFAULT VALUES;","UPDATE shopee_shipping_document_attempts SET state='uncertain';"]:
            assert sql(query,role,False).returncode!=0
    print('ROLE_DENIALS=PASS',flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:results=list(pool.map(lambda _:claim(),range(40)))
    assert sum(x.get('fresh') is True for x in results)==1
    assert len(set(x['attempt_id'] for x in results))==1
    print('REAL_CONCURRENCY=PASS fresh=1 blocked=39',flush=True)
    assert claim('WRONG_SHOP',shop=999)['status']=='account_or_shop_mismatch'
    assert claim('INACTIVE',acct='22222222-2222-4222-8222-222222222222')['status']=='account_or_shop_mismatch'
    sql("INSERT INTO order_documents(order_id,document_type) VALUES('%s','shipping_label');"%order)
    assert claim('ATTACHED')['status']=='existing_document_requires_reconciliation'
    sql("INSERT INTO order_documents(order_id,document_type) VALUES('%s','shipping_label');"%order)
    assert claim('DUPLICATE')['status']=='duplicate_documents_require_reconciliation'
    assert sql('SELECT count(*) FROM orders;').stdout.strip()=='1'
    print('IDENTITY_EXISTING_DOCUMENT_AND_ZERO_ORDER_WRITES=PASS',flush=True)
finally:
    subprocess.run(['docker','rm','-f',name],check=False,capture_output=True)
    names=subprocess.check_output(['docker','ps','-a','--format','{{.Names}}'],text=True).splitlines()
    assert name not in names
    print('LOCAL_POSTGRES_REMOVED=PASS',flush=True)
