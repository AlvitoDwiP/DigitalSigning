import hashlib
from pathlib import Path
from app.services import pki_engine

def get_primary_ca_hashes():
    pki_engine_dir, pki_dir, _, _, _, _, _ = pki_engine.get_pki_paths()
    primary_idx = (pki_dir / "intermediate" / "index.txt")
    primary_ser = (pki_dir / "intermediate" / "serial")
    idx_h = hashlib.sha256(primary_idx.read_bytes()).hexdigest() if primary_idx.exists() else None
    ser_h = hashlib.sha256(primary_ser.read_bytes()).hexdigest() if primary_ser.exists() else None
    return idx_h, ser_h

def test_generate_single_with_isolated_ca(isolated_ca):
    idx_before, ser_before = get_primary_ca_hashes()

    res = pki_engine.generate_single(
        name="Test User Iso",
        nik="1122334455667701",
        email="testiso1@mkri.go.id",
        organization="TEST ORG",
        ou="TEST OU",
        pfx_password="PfxPassword123!"
    )

    assert res["serial_number"] == "1001"
    assert Path(res["certificate_path"]).is_file()
    assert Path(res["p12_reference"]).is_file()

    # Pastikan file tercatat di TEST CA, bukan primary CA
    test_idx = (isolated_ca.int_dir / "index.txt").read_text()
    assert "1122334455667701" in test_idx or "Test User Iso" in test_idx
    assert (isolated_ca.int_dir / "serial").read_text().strip() == "1002"

    # Verifikasi integritas: Primary CA sama sekali tidak berubah!
    idx_after, ser_after = get_primary_ca_hashes()
    assert idx_before == idx_after
    assert ser_before == ser_after

def test_generate_bulk_with_isolated_ca(isolated_ca):
    idx_before, ser_before = get_primary_ca_hashes()

    requests = [
        {
            "name": "Bulk Iso One",
            "nik": "1122334455667702",
            "email": "bulk1@mkri.go.id",
            "organization": "TEST ORG",
            "ou": "IT",
            "pfx_password": "PfxPassword123!"
        },
        {
            "name": "Bulk Iso Two",
            "nik": "1122334455667703",
            "email": "bulk2@mkri.go.id",
            "organization": "TEST ORG",
            "ou": "IT",
            "pfx_password": "PfxPassword123!"
        }
    ]

    res = pki_engine.generate_bulk(requests)
    assert len(res["results"]) == 2
    for item in res["results"]:
        assert item["status"] == "SUCCESS"

    # Pastikan test CA mencatat serial
    test_idx = (isolated_ca.int_dir / "index.txt").read_text()
    assert "Bulk Iso One" in test_idx
    assert "Bulk Iso Two" in test_idx

    # Primary CA tetap identik
    idx_after, ser_after = get_primary_ca_hashes()
    assert idx_before == idx_after
    assert ser_before == ser_after

def test_regenerate_staged_commit_cleanup(isolated_ca):
    idx_before, ser_before = get_primary_ca_hashes()

    # 1. Stage
    stage = pki_engine.generate_staged(
        name="Regen User Iso",
        nik="1122334455667704",
        email="regen@mkri.go.id",
        organization="TEST ORG",
        ou="IT",
        pfx_password="Mkri006!"
    )
    assert "staging_token" in stage
    assert Path(stage["staging_token"]).is_dir()

    # 2. Commit
    commit_res = pki_engine.commit_staged(
        staging_token=stage["staging_token"],
        target_user_dir=stage["target_user_dir"],
        target_archive_p12=stage["target_archive_p12"]
    )
    assert commit_res is True
    assert not Path(stage["staging_token"]).exists()
    assert Path(stage["target_archive_p12"]).is_file()

    # 3. Test Passphrase Change
    change_res = pki_engine.change_p12_passphrase_admin(
        nik="1122334455667704",
        new_password="NewAdminPassword123!"
    )
    assert change_res is True

    # 4. Delete materials
    del_res = pki_engine.delete_user_pki_materials(nik="1122334455667704")
    assert del_res["success"] is True

    # Primary CA tetap identik
    idx_after, ser_after = get_primary_ca_hashes()
    assert idx_before == idx_after
    assert ser_before == ser_after
