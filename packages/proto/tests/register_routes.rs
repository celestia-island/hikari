#[cfg(test)]
mod test {
    use hikari_proto::register_routes;

    #[register_routes]
    #[derive(Debug, Clone, PartialEq, Eq)]
    enum TestEnum {
        A,
        B,
        C,
    }

    #[test]
    fn try_to_serialize() {
        let t = TestEnum::A;

        t.print_enums_test();
    }
}
