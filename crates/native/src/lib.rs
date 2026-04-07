use napi::{Error, Result, Status};
use napi_derive::napi;
use rusb::UsbContext;
use std::fs::File;
use std::io::Write;
use std::path::Path;
use std::process::Command;

const TOOL_ENV: &str = "CLAWKEYS_TOOL_PATH";

fn temp_yaml_path() -> std::io::Result<std::path::PathBuf> {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| {
            std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Failed to create temp path: {error}"),
            )
        })?
        .as_nanos();

    let mut temp_path = std::env::temp_dir();
    temp_path.push(format!(".clawkeys-{nanos}.yaml"));
    Ok(temp_path)
}

#[napi]
pub fn is_known_keypad_connected(vendor_id: u16, product_id: u16) -> bool {
    let context = match rusb::Context::new() {
        Ok(ctx) => ctx,
        Err(_) => return false,
    };

    let devices = match context.devices() {
        Ok(list) => list,
        Err(_) => return false,
    };

    for device in devices.iter() {
        let desc = match device.device_descriptor() {
            Ok(d) => d,
            Err(_) => continue,
        };

        if desc.vendor_id() == vendor_id && desc.product_id() == product_id {
            return true;
        }
    }

    false
}

#[napi]
pub fn run_pad_upload(payload: String, tool_path: Option<String>) -> Result<()> {
    let resolved_path = match tool_path {
        Some(value) if !value.is_empty() => value,
        _ => std::env::var(TOOL_ENV).map_err(|_| {
            Error::new(
                Status::Unknown,
                "Missing tool path. Set CLAWKEYS_TOOL_PATH to a ch57x-keyboard-tool binary.",
            )
        })?,
    };

    if !Path::new(&resolved_path).exists() {
        return Err(Error::new(
            Status::Unknown,
            format!("Missing helper binary at path: {resolved_path}"),
        ));
    }

    let temp_path = temp_yaml_path().map_err(Error::from)?;
    {
        let mut file = File::create(&temp_path).map_err(|error| {
            Error::new(
                Status::Unknown,
                format!("Failed to open temp file: {error}"),
            )
        })?;
        file.write_all(payload.as_bytes()).map_err(|error| {
            Error::new(
                Status::Unknown,
                format!("Failed to write temp file: {error}"),
            )
        })?;
    }

    let validate = Command::new(&resolved_path)
        .arg("validate")
        .arg(&temp_path)
        .output()
        .map_err(|error| {
            Error::new(
                Status::Unknown,
                format!("Failed to run helper validate: {error}"),
            )
        })?;

    if !validate.status.success() {
        let stderr = String::from_utf8_lossy(&validate.stderr);
        let _ = std::fs::remove_file(&temp_path);
        return Err(Error::new(
            Status::Unknown,
            format!("Helper validate failed: {}", stderr.trim()),
        ));
    }

    let upload = Command::new(&resolved_path)
        .arg("upload")
        .arg(&temp_path)
        .output()
        .map_err(|error| {
            Error::new(
                Status::Unknown,
                format!("Failed to run helper upload: {error}"),
            )
        })?;

    let _ = std::fs::remove_file(&temp_path);

    if !upload.status.success() {
        let stderr = String::from_utf8_lossy(&upload.stderr);
        return Err(Error::new(
            Status::Unknown,
            format!("Helper failed: {}", stderr.trim()),
        ));
    }

    Ok(())
}
