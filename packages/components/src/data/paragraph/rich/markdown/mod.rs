#[cfg(test)]
mod test {
    #[test]
    fn test() {
        use markdown::{to_mdast, ParseOptions};

        let input = r#"
```rust;ignored
fn main() {
    println!("Hello, world!");
}
```

<SomeComponent />

{a + b} // inline code
        "#;
        println!("{:?}", to_mdast(input, &ParseOptions::mdx()).unwrap());
    }
}
